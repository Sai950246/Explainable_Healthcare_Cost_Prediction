from pymongo import MongoClient
from datetime import datetime


MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "medical_costs_db"
COLLECTION_NAME = "patients"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
patients_collection = db[COLLECTION_NAME]


def insert_patient(
    name: str,
    length_of_stay: int,
    emergency_department_indicator: str,
    age_group: str,
    gender: str,
    apr_risk_of_mortality: str,
    payment_typology_1: str,
    predicted_cost: float
):
    """Insert a patient record with SPARCS dataset fields"""
    patient_doc = {
        "name": name,
        "length_of_stay": length_of_stay,
        "emergency_department_indicator": emergency_department_indicator,
        "age_group": age_group,
        "gender": gender,
        "apr_risk_of_mortality": apr_risk_of_mortality,
        "payment_typology_1": payment_typology_1,
        "predicted_cost": predicted_cost,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    result = patients_collection.insert_one(patient_doc)
    return str(result.inserted_id)


def get_all_patients():
    return list(
        patients_collection.find({}, {"_id": 0}).sort("created_at", -1)
    )


def get_patient_by_name(name: str):
    return patients_collection.find_one(
        {"name": name},
        {"_id": 0}
    )


def patient_exists(name: str):
    return patients_collection.count_documents({"name": name}) > 0


def delete_patient(name: str):
    result = patients_collection.delete_one({"name": name})
    return result.deleted_count
