from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from contextlib import asynccontextmanager

import pandas as pd
import joblib
import shap
import numpy as np

from auth import router as auth_router
from model_utils import train_and_select_model
from model_utils import NUMERIC_FEATURES, CATEGORICAL_FEATURES, engineer_features

# -------------------- CONFIG --------------------
MODEL_FILE = "best_model.joblib"
DATA_FILE = "sparcs.csv"

MODEL_METRICS = {}
model = None
explainer = None
X_reference = None


# -------------------- DATABASE --------------------
client = MongoClient("mongodb://localhost:27017/")
db = client["medical_costs_db"]
collection = db["patients"]


# -------------------- HELPER: Load Background Data for SHAP --------------------
def load_background_data():
    """Load a small sample of data for SHAP background when loading existing model"""
    try:
        df = pd.read_csv(DATA_FILE, low_memory=False, nrows=50000)
        
        # Clean Total Charges
        df["Total Charges"] = (
            df["Total Charges"]
            .astype(str)
            .str.replace("$", "", regex=False)
            .str.replace(",", "", regex=False)
        )
        df["Total Charges"] = pd.to_numeric(df["Total Charges"], errors="coerce")
        
        # Convert Emergency Indicator
        df["Emergency Department Indicator"] = (df["Emergency Department Indicator"] == "Y").astype(int)
        
        # Convert Length of Stay to numeric
        df["Length of Stay"] = df["Length of Stay"].astype(str).str.replace(r"\s*\+\s*$", "", regex=True)
        df["Length of Stay"] = pd.to_numeric(df["Length of Stay"], errors="coerce")
        
        # Convert numeric codes to numeric type
        for col in ["APR DRG Code", "APR MDC Code", "APR Severity of Illness Code", "Discharge Year"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        
        # Drop NA only on ORIGINAL columns first
        required_cols = [
            "Length of Stay",
            "Emergency Department Indicator",
            "APR DRG Code",
            "APR MDC Code",
            "APR Severity of Illness Code",
            "Discharge Year",
            "Age Group",
            "Gender",
            "Race",
            "Ethnicity",
            "Type of Admission",
            "Patient Disposition",
            "APR Risk of Mortality",
            "APR Medical Surgical Description",
            "Payment Typology 1",
            "Facility Name",
            "Total Charges"
        ]

        df = df.dropna(subset=required_cols)

        # THEN create engineered features
        df = engineer_features(df)
        
        if len(df) > 5000:
            df = df.sample(n=5000, random_state=42)
        
        X_bg = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
        globals()["X_reference"] = X_bg
        print(f"✅ Loaded {len(X_bg)} samples for SHAP background")
        return X_bg
    except Exception as e:
        import traceback
        print(f"⚠ Could not load background data: {str(e)[:80]}")
        traceback.print_exc()
        return None

# -------------------- TRAIN MODEL --------------------
def train_model():
    global MODEL_METRICS

    best_pipeline, metrics = train_and_select_model()
    
    MODEL_METRICS = {
        "best_model": metrics["best_model"],
        "cv_r2_score": metrics["cv_r2_mean"],
        "cv_r2_percentage": metrics["cv_r2_percentage"],
        "test_r2_score": metrics["test_r2"],
        "test_r2_percentage": metrics["test_r2_percentage"],
        "MAE": metrics["test_mae"],
        "RMSE": metrics["test_rmse"],
        "training_samples": metrics["training_samples"],
        "test_samples": metrics["test_samples"],
        "model_status": "Successfully Trained",
        "all_models_tested": metrics["all_models"],
        "last_trained": str(pd.Timestamp.now())
    }
    
    joblib.dump(MODEL_METRICS, MODEL_FILE + ".metrics")
    
    return best_pipeline


# -------------------- LIFESPAN --------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, explainer, MODEL_METRICS, X_reference

    try:
        model = joblib.load(MODEL_FILE)
        print("✅ Loaded existing model")
        
        # Load existing metrics
        metrics_file = MODEL_FILE + ".metrics"
        try:
            loaded_metrics = joblib.load(metrics_file)
            MODEL_METRICS.clear()
            MODEL_METRICS.update(loaded_metrics)
            print(f"✅ Loaded existing metrics (best_model={MODEL_METRICS.get('best_model')}, test_r2={MODEL_METRICS.get('test_r2_score', 0):.4f})")
        except Exception as e:
            print(f"⚠ Could not load metrics: {str(e)[:80]}")
            # Use defaults but don't zero out
            MODEL_METRICS.update({
                "best_model": "HistGradientBoosting",
                "model_status": "Loaded from disk (metrics unavailable)"
            })
        
        # Initialize SHAP for existing model
        try:
            X_reference = load_background_data()
            if X_reference is not None and len(X_reference) > 0:
                # Use TreeExplainer for tree-based models (safer than KernelExplainer)
                explainer = shap.TreeExplainer(model.named_steps['estimator'])
                print(f"✅ SHAP initialized with {len(X_reference)} reference samples")
            else:
                print("⚠ Could not initialize SHAP: insufficient reference data")
                explainer = None
        except Exception as e:
            print(f"⚠ SHAP initialization failed: {str(e)[:80]}")
            print("   Model explainability will be unavailable (predictions still work)")
            explainer = None
        
    except Exception as e:
        print("Training new model...")
        try:
            model = train_model()
            # Initialize SHAP for newly trained model
            try:
                X_reference = load_background_data()
                if X_reference is not None and len(X_reference) > 0:
                    explainer = shap.TreeExplainer(model.named_steps['estimator'])
                    print(f"✅ SHAP initialized for new model with {len(X_reference)} reference samples")
            except Exception as shap_err:
                print(f"⚠ SHAP initialization failed for new model: {str(shap_err)[:80]}")
                explainer = None
        except Exception as train_err:
            print(f"❌ Training failed: {str(train_err)[:80]}")
            model = None
            explainer = None

    yield

    print("🔴 Application shutdown")


# -------------------- APP --------------------
app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- SCHEMA --------------------
class PatientInput(BaseModel):
    name: str
    length_of_stay: int
    emergency_department_indicator: str
    apr_drg_code: int
    apr_mdc_code: int
    apr_severity_code: int
    ccs_diagnosis_code: int
    ccs_procedure_code: int
    age_group: str
    gender: str
    race: str
    ethnicity: str
    type_of_admission: str
    patient_disposition: str
    apr_risk_of_mortality: str
    apr_medical_surgical_description: str
    payment_typology_1: str
    facility_name: str
    discharge_year: int


# -------------------- ROUTES --------------------
@app.post("/predict")
def predict_cost(data: PatientInput):
    print(f"[PREDICT] Starting prediction for patient: {data.name}")
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Please wait for training to complete.")

    print(f"[PREDICT] Creating DataFrame...")
    df_input = pd.DataFrame([{
        "Length of Stay": data.length_of_stay,
        "Emergency Department Indicator": 1 if data.emergency_department_indicator == "Y" else 0,
        "APR DRG Code": data.apr_drg_code,
        "APR MDC Code": data.apr_mdc_code,
        "APR Severity of Illness Code": data.apr_severity_code,
        "CCS Diagnosis Code": data.ccs_diagnosis_code,
        "CCS Procedure Code": data.ccs_procedure_code,
        "Age Group": data.age_group,
        "Gender": data.gender,
        "Race": data.race,
        "Ethnicity": data.ethnicity,
        "Type of Admission": data.type_of_admission,
        "Patient Disposition": data.patient_disposition,
        "APR Risk of Mortality": data.apr_risk_of_mortality,
        "APR Medical Surgical Description": data.apr_medical_surgical_description,
        "Payment Typology 1": data.payment_typology_1,
        "Facility Name": data.facility_name,
        "Discharge Year": data.discharge_year
    }])

    print(f"[PREDICT] Engineering features...")
    df_input = engineer_features(df_input)
    print(f"[PREDICT] Features engineered. Shape: {df_input.shape}")

    print(f"[PREDICT] Making prediction...")
    raw_cost = float(model.predict(df_input)[0])
    actual_cost = max(raw_cost, 0.0)
    
    # Guard against invalid model outputs
    if np.isinf(actual_cost) or np.isnan(actual_cost):
        print(f"[PREDICT] Warning: Invalid prediction detected (raw_cost={raw_cost}), clamping to 0")
        actual_cost = 0.0
    
    print(f"[PREDICT] Prediction complete: ${actual_cost:.2f}")

    shap_values = {}
    if explainer:
        try:
            print(f"[PREDICT] Computing SHAP values...")
            transformed = model.named_steps["preprocessor"].transform(df_input)
            print(f"[PREDICT] Transformed shape: {transformed.shape}")
            shap_vals = explainer.shap_values(transformed)
            print(f"[PREDICT] SHAP calculation complete")
            feature_names = model.named_steps["preprocessor"].get_feature_names_out()
            
            # Handle different SHAP output formats
            # If shap_vals is a list (multi-output models), take the first element
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[0]
            
            # Get the correct shape - handle both 1D and 2D arrays
            if len(shap_vals.shape) == 1:
                sv = shap_vals  # Single sample returned as 1D
            else:
                sv = shap_vals[0]  # Multiple samples, take first
            
            # Build SHAP values dictionary
            shap_values = {
                str(feature_names[i]): float(sv[i])
                for i in range(min(len(feature_names), len(sv)))
            }
            print(f"[PREDICT] SHAP values built: {len(shap_values)} features")
        except Exception as e:
            import traceback
            print(f"⚠ Error calculating SHAP values: {str(e)}")
            traceback.print_exc()
            shap_values = {}

    print(f"[PREDICT] Saving to database...")
    record = {
        "name": data.name,
        "length_of_stay": data.length_of_stay,
        "emergency_department_indicator": data.emergency_department_indicator,
        "apr_drg_code": data.apr_drg_code,
        "apr_mdc_code": data.apr_mdc_code,
        "apr_severity_code": data.apr_severity_code,
        "ccs_diagnosis_code": data.ccs_diagnosis_code,
        "ccs_procedure_code": data.ccs_procedure_code,
        "age_group": data.age_group,
        "gender": data.gender,
        "race": data.race,
        "ethnicity": data.ethnicity,
        "type_of_admission": data.type_of_admission,
        "patient_disposition": data.patient_disposition,
        "apr_risk_of_mortality": data.apr_risk_of_mortality,
        "apr_medical_surgical_description": data.apr_medical_surgical_description,
        "payment_typology_1": data.payment_typology_1,
        "facility_name": data.facility_name,
        "discharge_year": data.discharge_year,
        "predicted_cost": float(actual_cost),
        "prediction_date": pd.Timestamp.utcnow(),
        "shap_values": shap_values
    }

    collection.insert_one(record)
    print(f"[PREDICT] Complete!")

    return {"predicted_cost": float(actual_cost), "shap_values": shap_values}


@app.get("/model-metrics")
def model_metrics():
    if not MODEL_METRICS:
        return {
            "R2_score": None,
            "R2_percentage": None,
            "MAE": None,
            "RMSE": None,
            "CV_R2_mean": None,
            "CV_R2_mean_percentage": None,
            "CV_R2_std": None,
            "best_model": "Not Trained",
            "model_type": "None",
            "model_status": "Loading",
            "accuracy_grade": "Loading",
            "message": "Model is still training. Please check back later."
        }
    
    # Map saved metrics to frontend expected keys
    return {
        "R2_score": MODEL_METRICS.get("test_r2_score", 0),
        "R2_percentage": MODEL_METRICS.get("test_r2_percentage", 0),
        "MAE": MODEL_METRICS.get("MAE", 0),
        "RMSE": MODEL_METRICS.get("RMSE", 0),
        "CV_R2_mean": MODEL_METRICS.get("cv_r2_score", 0),
        "CV_R2_mean_percentage": MODEL_METRICS.get("cv_r2_percentage", 0),
        "CV_R2_std": MODEL_METRICS.get("cv_r2_std", 0),
        "best_model": MODEL_METRICS.get("best_model", "Unknown"),
        "model_type": MODEL_METRICS.get("best_model", "Unknown"),
        "model_status": MODEL_METRICS.get("model_status", "Unknown"),
        "accuracy_grade": "Good" if MODEL_METRICS.get("test_r2_percentage", 0) > 0.75 else "Fair",
        "training_samples": MODEL_METRICS.get("training_samples", 0),
        "test_samples": MODEL_METRICS.get("test_samples", 0),
        "last_trained": MODEL_METRICS.get("last_trained", "Unknown"),
        "all_models": MODEL_METRICS.get("all_models_tested", {})
    }


# -------------------- HELPER: Clean infinite/NaN values from records --------------------
def clean_record(record):
    """Convert infinity and NaN values to None for JSON serialization"""
    if not isinstance(record, dict):
        return record
    
    cleaned = {}
    for key, value in record.items():
        if isinstance(value, float) and (np.isinf(value) or np.isnan(value)):
            cleaned[key] = None
        elif isinstance(value, (int, np.integer)):
            cleaned[key] = int(value)
        elif isinstance(value, (float, np.floating)):
            cleaned[key] = float(value)
        else:
            cleaned[key] = value
    return cleaned


@app.get("/patients")
def get_patients():
    patients = list(collection.find({}, {"_id": 0}))
    # Clean any infinity/NaN values that might have been saved
    return [clean_record(p) for p in patients]


@app.get("/patients/{name}")
def get_patient(name: str):
    patient = collection.find_one({"name": name}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return clean_record(patient)


@app.delete("/patients/{name}")
def delete_patient(name: str):
    result = collection.delete_one({"name": name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Deleted successfully"}


@app.get("/stats")
def get_stats():
    df = pd.DataFrame(list(collection.find({}, {"_id": 0})))

    if df.empty:
        return {"total_patients": 0}

    # Clean infinity/NaN values from the cost column
    if "predicted_cost" in df.columns:
        df["predicted_cost"] = df["predicted_cost"].replace([np.inf, -np.inf], np.nan)
        avg_cost = float(df["predicted_cost"].mean()) if not pd.isna(df["predicted_cost"].mean()) else 0
        avg_cost = round(avg_cost, 2) if not (np.isinf(avg_cost) or np.isnan(avg_cost)) else 0
    else:
        avg_cost = 0

    if "emergency_department_indicator" in df.columns:
        total = len(df)
        er_count = df[df["emergency_department_indicator"].isin(["Y", "Yes", 1, True])].shape[0]
        er_percentage = round((er_count / total) * 100, 2) if total > 0 else 0
    else:
        er_percentage = 0

    return {
        "total_patients": len(df),
        "average_predicted_cost": avg_cost,
        "average_length_of_stay": float(df["length_of_stay"].mean()) if not pd.isna(df["length_of_stay"].mean()) else 0,
        "er_visit_percentage": er_percentage
    }



@app.get("/shap/{name}")
def get_patient_shap(name: str):
    patient = collection.find_one({"name": name}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # If SHAP values missing or empty, calculate them now
    if not patient.get("shap_values"):
        if explainer is None:
            return {
                "name": patient.get("name", name),
                "predicted_cost": patient.get("predicted_cost", 0),
                "shap_values": {},
                "warning": "SHAP explainer not available"
            }
        
        try:
            # Reconstruct the input from stored patient data
            df_patient = pd.DataFrame([{
                "Length of Stay": patient["length_of_stay"],
                "Emergency Department Indicator": 1 if patient["emergency_department_indicator"] == "Y" else 0,
                "APR DRG Code": patient["apr_drg_code"],
                "APR MDC Code": patient["apr_mdc_code"],
                "APR Severity of Illness Code": patient["apr_severity_code"],
                "Age Group": patient["age_group"],
                "Gender": patient["gender"],
                "Race": patient["race"],
                "Ethnicity": patient["ethnicity"],
                "Type of Admission": patient["type_of_admission"],
                "Patient Disposition": patient["patient_disposition"],
                "APR Risk of Mortality": patient["apr_risk_of_mortality"],
                "APR Medical Surgical Description": patient["apr_medical_surgical_description"],
                "Payment Typology 1": patient["payment_typology_1"],
                "Facility Name": patient["facility_name"],
                "Discharge Year": patient["discharge_year"]
            }])

            df_patient = engineer_features(df_patient)
            transformed = model.named_steps["preprocessor"].transform(df_patient)
            shap_vals = explainer.shap_values(transformed)
            feature_names = model.named_steps["preprocessor"].get_feature_names_out()
            
            # Handle different SHAP output formats
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[0]
            
            if len(shap_vals.shape) == 1:
                sv = shap_vals
            else:
                sv = shap_vals[0]
            
            shap_values = {
                str(feature_names[i]): float(sv[i])
                for i in range(min(len(feature_names), len(sv)))
            }
            
            # Update patient record with calculated SHAP values
            collection.update_one(
                {"name": name},
                {"$set": {"shap_values": shap_values}}
            )
        except Exception as e:
            print(f"❌ SHAP calculation failed for {name}: {str(e)[:80]}")
            shap_values = {}
    else:
        shap_values = patient.get("shap_values", {})

    return {
        "name": patient.get("name", name),
        "predicted_cost": patient.get("predicted_cost", 0),
        "shap_values": shap_values
    }


@app.post("/recalculate-shap")
def recalculate_all_shap():
    """Recalculate SHAP values for all existing patients missing them"""
    if explainer is None or model is None:
        raise HTTPException(status_code=503, detail="Model or SHAP explainer not available")
    
    try:
        patients = list(collection.find({"shap_values": {"$exists": False}}, {"_id": 0, "name": 1}))
        updated_count = 0
        
        for patient in patients:
            try:
                name = patient.get("name", "Unknown")
                patient_doc = collection.find_one({"name": name}, {"_id": 0})
                
                df_patient = pd.DataFrame([{
                    "Length of Stay": patient["length_of_stay"],
                    "Emergency Department Indicator": 1 if patient["emergency_department_indicator"] == "Y" else 0,
                    "APR DRG Code": patient["apr_drg_code"],
                    "APR MDC Code": patient["apr_mdc_code"],
                    "APR Severity of Illness Code": patient["apr_severity_code"],
                    "Age Group": patient["age_group"],
                    "Gender": patient["gender"],
                    "Race": patient["race"],
                    "Ethnicity": patient["ethnicity"],
                    "Type of Admission": patient["type_of_admission"],
                    "Patient Disposition": patient["patient_disposition"],
                    "APR Risk of Mortality": patient["apr_risk_of_mortality"],
                    "APR Medical Surgical Description": patient["apr_medical_surgical_description"],
                    "Payment Typology 1": patient["payment_typology_1"],
                    "Facility Name": patient["facility_name"],
                    "Discharge Year": patient["discharge_year"]
                }])

                df_patient = engineer_features(df_patient)
                transformed = model.named_steps["preprocessor"].transform(df_patient)
                shap_vals = explainer.shap_values(transformed)
                feature_names = model.named_steps["preprocessor"].get_feature_names_out()
                
                # Handle different SHAP output formats
                if isinstance(shap_vals, list):
                    shap_vals = shap_vals[0]
                
                if len(shap_vals.shape) == 1:
                    sv = shap_vals
                else:
                    sv = shap_vals[0]
                
                shap_values = {
                    str(feature_names[i]): float(sv[i])
                    for i in range(min(len(feature_names), len(sv)))
                }
                
                collection.update_one(
                    {"name": name},
                    {"$set": {"shap_values": shap_values}}
                )
                updated_count += 1
            except Exception as e:
                print(f"⚠ Failed to calculate SHAP for {name}: {str(e)[:60]}")
        
        return {
            "message": "SHAP recalculation complete",
            "patients_updated": updated_count,
            "total_patients_processed": len(patients)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recalculation failed: {str(e)[:80]}")

