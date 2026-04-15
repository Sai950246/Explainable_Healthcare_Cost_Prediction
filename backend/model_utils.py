import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Lasso


MODEL_FILE = "best_model.joblib"
DATA_FILE = "sparcs.csv"


NUMERIC_FEATURES = [
    "Length of Stay",
    "Emergency Department Indicator",
    "APR DRG Code",
    "APR MDC Code",
    "APR Severity of Illness Code",
    "Discharge Year",
    # Engineered
    "severity_x_mortality",
    "drg_x_severity",
    "mdc_x_severity",
    "log_los",
    "los_x_severity",
    "los_x_emergency",
    "emergency_x_severity",
    "facility_code",
    "drg_frequency"
]

CATEGORICAL_FEATURES = [
    "Age Group",
    "Gender",
    "Race",
    "Ethnicity",
    "Type of Admission",
    "Patient Disposition",
    "APR Risk of Mortality",
    "APR Medical Surgical Description",
    "Payment Typology 1"
]


def build_preprocessor():
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(
                drop="first",
                handle_unknown="ignore",
                sparse_output=True
            ), CATEGORICAL_FEATURES),
        ]
    )


def engineer_features(df):
    mortality_map = {"Minor": 1, "Moderate": 2, "Major": 3, "Extreme": 4}
    
    # Clinical Severity Power
    mort_scores = df["APR Risk of Mortality"].map(mortality_map).fillna(1)
    df["severity_x_mortality"] = df["APR Severity of Illness Code"] * mort_scores
    df["drg_x_severity"] = df["APR DRG Code"] * df["APR Severity of Illness Code"]
    df["mdc_x_severity"] = df["APR MDC Code"] * df["APR Severity of Illness Code"]
    
    # Length of Stay Power
    df["log_los"] = np.log1p(df["Length of Stay"])
    df["los_x_severity"] = df["Length of Stay"] * df["APR Severity of Illness Code"]
    df["los_x_emergency"] = df["Length of Stay"] * df["Emergency Department Indicator"]
    
    # Admission Complexity
    df["emergency_x_severity"] = df["Emergency Department Indicator"] * df["APR Severity of Illness Code"]
    
    # Facility Behavior Signal
    if len(df) > 1 and "Facility Name" in df.columns:
        df["facility_code"] = df["Facility Name"].astype("category").cat.codes
    else:
        df["facility_code"] = 0
    
    # DRG Group Density
    if len(df) > 1:
        drg_freq = df["APR DRG Code"].map(df["APR DRG Code"].value_counts())
    else:
        drg_freq = pd.Series([1], index=df.index)
    df["drg_frequency"] = drg_freq
    
    return df


def load_data():
    df = pd.read_csv(DATA_FILE, low_memory=False)
    print(f"\n📊 Loaded raw data: {len(df):,} records")

    # Clean target
    df["Total Charges"] = df["Total Charges"].astype(str)\
        .str.replace('$', '', regex=False)\
        .str.replace(',', '', regex=False)

    df["Total Charges"] = pd.to_numeric(df["Total Charges"], errors="coerce")

    # Convert emergency indicator
    df["Emergency Department Indicator"] = (
        df["Emergency Department Indicator"] == "Y"
    ).astype(int)

    # Clean Length of Stay
    df["Length of Stay"] = df["Length of Stay"].astype(str)\
        .str.replace(r"\s*\+\s*$", "", regex=True)

    df["Length of Stay"] = pd.to_numeric(df["Length of Stay"], errors="coerce")

    # Drop invalid rows (check only base features, not engineered ones)
    base_numeric = ["Length of Stay", "Emergency Department Indicator", "APR DRG Code", 
                     "APR MDC Code", "APR Severity of Illness Code", "Discharge Year"]
    required_cols = base_numeric + CATEGORICAL_FEATURES + ["Total Charges"]
    df = df.dropna(subset=required_cols)
    print(f"📊 After removing NAs: {len(df):,} records")

    df = df[df["Total Charges"] > 0]
    df = df[df["Total Charges"] < df["Total Charges"].quantile(0.99)]
    print(f"📊 After outlier removal: {len(df):,} records")

    # Engineer features
    df = engineer_features(df)
    
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = df["Total Charges"]
    
    print(f"✅ Final training dataset: {len(X):,} records\n")

    return X, y


def train_and_select_model():
    """
    Test 3 models using cross-validation and select the best one.
    Research Paper Approach: Decision Tree, HistGradientBoosting, Lasso Regression
    """
    X, y = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.1,
        random_state=42
    )
    
    print(f"📊 Training set: {len(X_train):,} records (90%)")
    print(f"📊 Test set: {len(X_test):,} records (10%)\n")

    preprocessor = build_preprocessor()

    # 3 Core Models (Research Paper Approach)
    models = {
        "Decision Tree (depth=13)": DecisionTreeRegressor(
            max_depth=13,
            random_state=42,
            min_samples_leaf=5
        ),
        "HistGradientBoosting": HistGradientBoostingRegressor(
            max_iter=500,
            learning_rate=0.03,
            max_depth=10,
            min_samples_leaf=5,
            l2_regularization=0.01,
            early_stopping="auto",
            validation_fraction=0.1,
            n_iter_no_change=20,
            random_state=42
        ),
        "Lasso": Lasso(
            alpha=0.1,
            max_iter=2500,
            random_state=42
        )
    }

    best_cv_score = -np.inf
    best_model = None
    best_name = ""
    all_results = {}

    print("=" * 70)
    print("🔎 CROSS-VALIDATION MODEL SELECTION (5-Fold CV)")
    print("=" * 70 + "\n")

    # Step 1: Compare models using cross-validation
    for name, estimator in models.items():
        pipe = Pipeline([
            ("preprocessor", preprocessor),
            ("estimator", estimator)
        ])

        # 5-fold cross-validation
        cv_scores = cross_val_score(
            pipe, X_train, y_train,
            cv=5,
            scoring="r2",
            n_jobs=-1
        )

        mean_cv_score = cv_scores.mean()
        std_cv_score = cv_scores.std()

        print(f"📊 {name}")
        print(f"   CV R² Scores: {[f'{s:.4f}' for s in cv_scores]}")
        print(f"   Mean CV R²: {mean_cv_score:.4f} (+/- {std_cv_score:.4f})")

        all_results[name] = {
            "mean_cv_score": mean_cv_score,
            "std_cv_score": std_cv_score,
            "cv_scores": cv_scores,
            "model": estimator
        }

        if mean_cv_score > best_cv_score:
            best_cv_score = mean_cv_score
            best_name = name
            best_model = estimator

        print()

    print("=" * 70)
    print(f"✅ BEST MODEL: {best_name}")
    print(f"   CV R² Score: {best_cv_score:.4f}")
    print("=" * 70 + "\n")

    # Step 2: Train best model on full training data
    print(f"🚀 Training {best_name} on full dataset...")
    best_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("estimator", best_model)
    ])

    best_pipeline.fit(X_train, y_train)

    # Step 3: Evaluate on test set
    test_preds = best_pipeline.predict(X_test)
    test_r2 = r2_score(y_test, test_preds)
    test_mae = mean_absolute_error(y_test, test_preds)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_preds))

    print(f"\n📈 Test Set Performance:")
    print(f"   R² Score: {test_r2:.4f}")
    print(f"   R² %: {test_r2 * 100:.2f}%")
    print(f"   MAE: ${test_mae:,.2f}")
    print(f"   RMSE: ${test_rmse:,.2f}")

    # Step 4: Prepare metrics dictionary
    model_metrics = {
        "best_model": best_name,
        "cv_r2_mean": float(best_cv_score),
        "cv_r2_percentage": float(best_cv_score * 100),
        "test_r2": float(test_r2),
        "test_r2_percentage": float(test_r2 * 100),
        "test_mae": float(test_mae),
        "test_rmse": float(test_rmse),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "all_models": {
            name: {
                "mean_cv_score": float(results["mean_cv_score"]),
                "std_cv_score": float(results["std_cv_score"]),
                "cv_scores": [float(s) for s in results["cv_scores"]]
            }
            for name, results in all_results.items()
        }
    }

    # Step 5: Save only the best model
    joblib.dump(best_pipeline, MODEL_FILE)
    print(f"\n✅ Best model saved to {MODEL_FILE}\n")

    return best_pipeline, model_metrics