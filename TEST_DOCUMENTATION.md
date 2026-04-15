# Test Cases and Scenarios Documentation

# Dataset
#The dataset used in this project is not included in this repository due to its large size.
#You can download it from:
#https://health.data.ny.gov/Health/Hospital-Inpatient-Discharges-SPARCS-De-Identified/gnzp-ekau/about_data

## Healthcare Cost Prediction System

**Project:** Hospital Patient Resource Allocation & Healthcare Cost Prediction  
**Date:** April 2026  
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Unit Test Cases](#unit-test-cases)
3. [Integration Test Cases](#integration-test-cases)
4. [Data Quality Scenarios](#data-quality-scenarios)
5. [Model Performance Scenarios](#model-performance-scenarios)
6. [User Interface Test Scenarios](#user-interface-test-scenarios)
7. [Error & Edge Cases](#error--edge-cases)
8. [Performance Test Scenarios](#performance-test-scenarios)
9. [Regression Test Scenarios](#regression-test-scenarios)

---

## Overview

This document outlines comprehensive test cases and scenarios designed to validate the healthcare cost prediction system across all layers: data processing, model training, API endpoints, and user interface.

### Testing Objectives:

- Ensure data integrity and preprocessing accuracy
- Validate model performance and stability
- Test API reliability and error handling
- Verify user interface functionality
- Identify edge cases and failure modes
- Establish performance baselines

### Testing Tools:

- **Unit Testing:** pytest
- **Integration Testing:** pytest with fixtures
- **API Testing:** Postman / pytest-requests
- **Performance Testing:** timeit, cProfile
- **Validation:** Data profiling tools

---

## Unit Test Cases

### 1.1 Feature Engineering Tests

#### Test Case: UC-FE-001 - Severity × Mortality Interaction

**Purpose:** Verify clinical interaction feature is calculated correctly

**Module:** `model_utils.py::engineer_features()`

**Preconditions:**

- Test dataframe with required columns exists
- APR Risk of Mortality column contains valid values: "Minor", "Moderate", "Major", "Extreme"

**Test Steps:**

1. Create test patient record with:
   - APR Severity of Illness Code = 3
   - APR Risk of Mortality = "Major"
2. Call `engineer_features()` on test dataframe
3. Retrieve `severity_x_mortality` column value

**Expected Result:**

```
severity_x_mortality = APR Severity (3) × Mortality Map Value (3) = 9
```

**Pass Criteria:** Actual output = 9  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-FE-002 - Log Length of Stay Transformation

**Purpose:** Validate logarithmic transformation of Length of Stay prevents skewness

**Module:** `model_utils.py::engineer_features()`

**Preconditions:**

- Length of Stay column contains positive values (1-100+ days)

**Test Steps:**

1. Input Length of Stay values: [1, 10, 100, 999]
2. Apply log transformation: `log_los = log1p(Length of Stay)`
3. Verify output distribution

**Expected Result:**

```
Input: [1, 10, 100, 999]
Output: [0.693, 2.398, 4.615, 6.908]  (log1p applies log(1+x))
```

**Pass Criteria:** Values follow logarithmic scale, no negative outputs  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-FE-003 - DRG Frequency Encoding

**Purpose:** Verify facility density signal captures DRG distribution

**Module:** `model_utils.py::engineer_features()`

**Test Steps:**

1. Create test dataset with DRG codes: [100, 100, 100, 200, 200]
2. Calculate DRG frequency using `value_counts()`
3. Verify frequency mapping

**Expected Result:**

```
DRG 100 appears 3 times → drg_frequency = 3
DRG 200 appears 2 times → drg_frequency = 2
```

**Pass Criteria:** Frequencies match distribution  
**Priority:** MEDIUM  
**Status:** Pending

---

#### Test Case: UC-FE-004 - Missing Value Handling in Features

**Purpose:** Ensure feature engineering handles missing values gracefully

**Test Steps:**

1. Create dataset with NaN in APR Risk of Mortality
2. Apply mortality mapping with `.fillna(1)` default
3. Verify no NaN propagation to engineered features

**Expected Result:**

```
NaN in mortality → Mapped to 1 (fallback value)
Engineered features have no NaN values
```

**Pass Criteria:** No NaN in output features  
**Priority:** HIGH  
**Status:** Pending

---

### 1.2 Data Preprocessing Tests

#### Test Case: UC-DP-001 - Currency Cleaning

**Purpose:** Verify Total Charges are correctly parsed from formatted strings

**Module:** `model_utils.py::load_data()`

**Test Cases:**
| Input | Expected Output | Status |
|-------|-----------------|--------|
| "$1,234.56" | 1234.56 | Pending |
| "999999.00" | 999999.00 | Pending |
| "$0.50" | 0.50 | Pending |
| "-$100" (if applicable) | -100 | Pending |

**Pass Criteria:** All conversions match expected values  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-DP-002 - Emergency Indicator Conversion

**Purpose:** Convert Y/N emergency indicator to 1/0 binary

**Module:** `model_utils.py::load_data()`

**Test Steps:**

1. Input Emergency Department Indicator: ['Y', 'N', 'Y', 'N']
2. Apply conversion: `(column == "Y").astype(int)`
3. Verify binary output

**Expected Result:**

```
['Y', 'N', 'Y', 'N'] → [1, 0, 1, 0]
```

**Pass Criteria:** All Y→1, all N→0  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-DP-003 - Outlier Removal (99th Percentile)

**Purpose:** Remove extreme charges that represent billing errors

**Module:** `model_utils.py::load_data()`

**Test Steps:**

1. Load dataset with charges: [100, 500, 1000, 50000, 5000000]
2. Calculate 99th percentile
3. Filter values above threshold

**Expected Result:**

```
Original records: 2,319,928
After removing top 1%: ~2,296,800 records
Charge range: $0 - Normal distribution without extreme outliers
```

**Pass Criteria:** Charges > 99th percentile removed  
**Priority:** MEDIUM  
**Status:** Pending

---

#### Test Case: UC-DP-004 - Missing Value Filtering

**Purpose:** Remove rows with critical missing features

**Module:** `model_utils.py::load_data()`

**Required Columns for NA Check:**

```
Base Numeric: Length of Stay, Emergency Department Indicator,
              APR DRG Code, APR MDC Code, APR Severity of Illness Code,
              Discharge Year

Categorical: Age Group, Gender, Race, Ethnicity, Type of Admission,
             Patient Disposition, APR Risk of Mortality,
             APR Medical Surgical Description, Payment Typology 1

Target: Total Charges
```

**Test Steps:**

1. Introduce NaN in critical columns
2. Apply `dropna(subset=required_cols)`
3. Verify rows are removed

**Expected Result:**

```
Original: 2,343,429 → After NA removal: 2,343,362 → After outlier: 2,319,928
```

**Pass Criteria:** Rows with any critical NaN are removed  
**Priority:** HIGH  
**Status:** Pending

---

### 1.3 Model Training Tests

#### Test Case: UC-MT-001 - Cross-Validation Setup

**Purpose:** Verify 5-fold cross-validation is executed correctly

**Module:** `model_utils.py::train_and_select_model()`

**Test Steps:**

1. Load training data with 2.3M records
2. Execute `cross_val_score()` with cv=5
3. Verify output structure

**Expected Result:**

```
cv_scores array with 5 values
Each fold gets ~464K training + ~116K validation samples
All scores between -1.0 and 1.0 (valid R² range)
```

**Pass Criteria:** 5 scores returned, all valid R² values  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-MT-002 - Best Model Selection

**Purpose:** Verify highest R² model is selected

**Models:**

- Decision Tree (depth=13)
- HistGradientBoosting
- Lasso

**Test Steps:**

1. Train all 3 models via 5-fold CV
2. Compare mean R² scores
3. Verify best model is selected

**Expected Result:**

```
Decision Tree R²: ~0.75
HistGradientBoosting R²: ~0.79 ← Selected (highest)
Lasso R²: ~0.68
Best model name stored in model_metrics["best_model"]
```

**Pass Criteria:** Model with highest mean R² is selected  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-MT-003 - Model Serialization

**Purpose:** Verify model is saved and can be reloaded

**Module:** `model_utils.py::train_and_select_model()`

**Test Steps:**

1. Train model and save to `best_model.joblib`
2. Verify file exists
3. Load model with `joblib.load()`
4. Make prediction on test data
5. Compare predictions before/after serialization

**Expected Result:**

```
File created: best_model.joblib (~15-50MB)
Predictions identical after reload (within floating-point precision)
```

**Pass Criteria:** Model loads successfully and produces identical predictions  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-MT-004 - Prediction Output Validation

**Purpose:** Verify model predictions are valid numeric values

**Test Steps:**

1. Load trained model
2. Make prediction on test set (290K records)
3. Validate output

**Expected Result:**

```
Output shape: (290000,)
Data type: float64
Value range: $0 - $500,000 (realistic medical charges)
No NaN or Inf values
```

**Pass Criteria:** All predictions are valid floats, within expected range  
**Priority:** HIGH  
**Status:** Pending

---

## Integration Test Cases

### 2.1 Pipeline Tests

#### Test Case: UC-IP-001 - End-to-End Training Pipeline

**Purpose:** Verify complete data flow from CSV to trained model

**Flow:**

```
sparcs.csv → load_data() → preprocess → engineer features →
cross_validate → select best → train → save → MODEL_FILE
```

**Test Steps:**

1. Start with fresh sparcs.csv
2. Run `train_and_select_model()`
3. Verify all outputs

**Expected Result:**

```
✓ Data loaded: 2,319,928 records
✓ Split: 2,087,935 train + 231,993 test
✓ 5-fold CV completed for all 3 models
✓ Best model identified (HistGradientBoosting R² = 0.79)
✓ Test performance: R² = 0.78, MAE = $2,500
✓ Model saved to best_model.joblib
```

**Pass Criteria:** All steps completed without errors  
**Priority:** CRITICAL  
**Status:** Pending

---

#### Test Case: UC-IP-002 - Pipeline Reproducibility

**Purpose:** Verify same results with fixed random_state

**Test Steps:**

1. Run training pipeline with random_state=42
2. Record metrics (R² scores, MAE, RMSE)
3. Delete model file
4. Run training again with same random_state=42
5. Compare metrics

**Expected Result:**

```
Run 1 R²:  0.7909 ± 0.0013
Run 2 R²:  0.7909 ± 0.0013
Metrics match exactly (reproducible)
```

**Pass Criteria:** Metrics identical across runs  
**Priority:** HIGH  
**Status:** Pending

---

#### Test Case: UC-IP-003 - Preprocessing Consistency

**Purpose:** Verify preprocessing produces consistent output

**Test Steps:**

1. Load same training data twice
2. Apply `build_preprocessor()` to each
3. Compare transformed features

**Expected Result:**

```
Feature scaling identical
One-hot encoding produces same columns
Sparse matrix structure identical
```

**Pass Criteria:** Identical preprocessing output  
**Priority:** MEDIUM  
**Status:** Pending

---

### 2.2 API Integration Tests

#### Test Case: UC-AI-001 - Prediction API Endpoint

**Purpose:** Test `/predict` endpoint with valid patient data

**Endpoint:** `POST /predict`

**Request Body:**

```json
{
  "Length of Stay": 5,
  "Emergency Department Indicator": "Y",
  "APR DRG Code": 203,
  "APR MDC Code": 5,
  "APR Severity of Illness Code": 2,
  "Discharge Year": 2023,
  "Age Group": "18 to 29",
  "Gender": "M",
  "Race": "Black/African American",
  "Ethnicity": "Not Span/Hispanic",
  "Type of Admission": "Emergency",
  "Patient Disposition": "Discharge to home or self care",
  "APR Risk of Mortality": "Minor",
  "APR Medical Surgical Description": "Medical",
  "Payment Typology 1": "Medicare"
}
```

**Expected Response:**

```json
{
  "predicted_charge": 15234.5,
  "confidence_interval": {
    "lower": 12000.0,
    "upper": 18500.0
  },
  "status": "success"
}
```

**Pass Criteria:**

- HTTP 200 Status
- Valid numeric prediction
- Prediction > 0
- Response time < 100ms

**Priority:** CRITICAL  
**Status:** Pending

---

#### Test Case: UC-AI-002 - Invalid Request Handling

**Purpose:** Test API error handling with malformed requests

**Test Cases:**

| Scenario               | Request                 | Expected Response      | Status Code |
| ---------------------- | ----------------------- | ---------------------- | ----------- |
| Missing required field | No "Length of Stay"     | Field validation error | 400         |
| Invalid data type      | "Length of Stay": "abc" | Type error message     | 400         |
| Negative value         | "Length of Stay": -5    | Value error message    | 400         |
| Model not loaded       | Model file missing      | Service unavailable    | 503         |

**Pass Criteria:** Appropriate error messages for each scenario  
**Priority:** HIGH  
**Status:** Pending

---

## Data Quality Scenarios

### 3.1 Input Data Validation

#### Scenario: SC-DQ-001 - Valid Patient Record

**Input:**

```
Patient ID: P001
Length of Stay: 7 days
Emergency: Y
DRG Code: 203 (valid range)
Severity: 3 (valid range 1-4)
Age Group: "65 to 79"
Gender: "M"
```

**Expected Outcome:** ✓ Accepted, prediction generated  
**Actual Outcome:** [To be tested]

---

#### Scenario: SC-DQ-002 - Missing Critical Field

**Input:**

```
Patient ID: P002
Length of Stay: 7 days
Emergency: Y
DRG Code: [MISSING]
Severity: 3
Age Group: "65 to 79"
```

**Expected Outcome:** ✗ Rejected with "DRG Code required" message  
**Actual Outcome:** [To be tested]

---

#### Scenario: SC-DQ-003 - Out-of-Range Value

**Input:**

```
Length of Stay: 0 (invalid, must be ≥ 1)
APR Severity of Illness Code: 5 (invalid, range is 1-4)
APR Risk of Mortality: "Unknown" (not in valid list)
```

**Expected Outcome:** ✗ Rejected with validation error  
**Actual Outcome:** [To be tested]

---

#### Scenario: SC-DQ-004 - Extreme Values

**Input:**

```
Length of Stay: 999 days (extreme but possible)
Total Charges: $10,000,000 (extreme, likely error)
Emergency Department Indicator: Y
```

**Expected Outcome:**

- Record accepted if within data distribution
- Flagged for review if beyond 99th percentile
- Outlier treatment applied during training

**Actual Outcome:** [To be tested]

---

### 3.2 Data Type Validation

| Field               | Valid Type    | Invalid Examples | Handling          |
| ------------------- | ------------- | ---------------- | ----------------- |
| Length of Stay      | Numeric (1+)  | "7 days", -5, 0  | Parse or reject   |
| APR Severity Code   | Integer (1-4) | 5, "High", 3.5   | Reject            |
| Age Group           | Categorical   | Random string    | Reject or default |
| Gender              | M/F/Other     | Numbers, symbols | Reject            |
| Emergency Indicator | Y/N or 1/0    | "yes", "no", 2   | Convert or reject |

---

## Model Performance Scenarios

### 4.1 Cross-Validation Performance

#### Scenario: SC-MP-001 - Stable Cross-Validation Performance

**Objective:** Verify model generalizes across all folds

**Expected Output:**

```
Fold 1 R²: 0.7898
Fold 2 R²: 0.7910
Fold 3 R²: 0.7905
Fold 4 R²: 0.7918
Fold 5 R²: 0.7908

Mean CV R²: 0.7908 (+/- 0.0008)
Standard Deviation: 0.0008 (< 0.01 = Stable) ✓
```

**Pass Criteria:**

- All fold R² within Mean ± 0.01
- Std Dev < 0.01 (indicates stability)
- No single fold significantly lower (indicates overfitting to other folds)

**Status:** Pending

---

#### Scenario: SC-MP-002 - Model Comparison

**Objective:** Compare performance across Decision Tree, HistGradientBoosting, Lasso

**Expected Results:**

| Model                | Mean CV R² | Test R² | MAE    | Status                  |
| -------------------- | ---------- | ------- | ------ | ----------------------- |
| Decision Tree        | 0.755      | 0.752   | $3,200 | Baseline                |
| HistGradientBoosting | 0.791      | 0.788   | $2,400 | **Best**                |
| Lasso                | 0.680      | 0.675   | $4,100 | Fast but lower accuracy |

**Winner:** HistGradientBoosting (highest R² with good speed)

**Status:** Pending

---

### 4.2 Generalization & Overfitting Tests

#### Scenario: SC-MP-003 - No Overfitting Detection

**Test:**

```
Training R²: 0.82
Test R² (unseen data): 0.79
Gap: 0.03 (acceptable, < 0.05 threshold)
```

**Pass Criteria:** Test R² within 0.03 of Training R² → No significant overfitting ✓

**Status:** Pending

---

#### Scenario: SC-MP-004 - Prediction Error Distribution

**Objective:** Verify errors are normally distributed (not biased)

**Test Steps:**

1. Generate predictions on test set
2. Calculate residuals (actual - predicted)
3. Analyze distribution

**Expected Results:**

```
Mean residual: ≈ 0 (unbiased)
Std deviation of residuals: $2,500
95% of errors within ±$5,000 (2σ)
No systematic bias toward over/under-prediction
```

**Status:** Pending

---

## User Interface Test Scenarios

### 5.1 New Patient Entry

#### Scenario: SC-UI-001 - Submit New Patient Prediction

**User Flow:**

1. Click "New Patient" button
2. Fill form with valid fields
3. Click "Predict Cost"

**Expected Outcome:**

```
✓ Form validation passes
✓ Prediction request sent to backend
✓ Results displayed: "Predicted Charge: $15,234"
✓ Response time: < 2 seconds
```

**Status:** Pending

---

#### Scenario: SC-UI-002 - Form Validation

**Test Cases:**

| Field          | Input            | Expected Behavior              |
| -------------- | ---------------- | ------------------------------ |
| Length of Stay | [Empty]          | Red error: "Required field"    |
| Age Group      | "100+"           | Red error: "Invalid age group" |
| Emergency      | [Pre-selected Y] | Accepted                       |
| All fields     | [Valid data]     | Green checkmark, enable submit |

**Status:** Pending

---

### 5.2 Existing Patient Retrieval

#### Scenario: SC-UI-003 - Search and View History

**User Flow:**

1. Navigate to "Existing Patient"
2. Enter Patient ID: P001
3. Click Search
4. View prediction history

**Expected Outcome:**

```
✓ Previous predictions loaded
✓ Date, predicted charge, actual charge (if available) displayed
✓ Update prediction button enabled
```

**Status:** Pending

---

### 5.3 Dashboard Metrics Display

#### Scenario: SC-UI-004 - Model Statistics Display

**Expected Dashboard Metrics:**

```
Model Selected: HistGradientBoosting
Training Samples: 2,087,935
Test Samples: 231,993
CV R² Score: 0.7909 ± 0.0013
Test R²: 0.7884
MAE: $2,456
RMSE: $5,234
```

**Pass Criteria:** All metrics displayed accurately  
**Status:** Pending

---

## Error & Edge Cases

### 6.1 System Errors

#### Test Case: EC-SE-001 - Model File Not Found

**Scenario:** Model file deleted or corrupted

**Expected Behavior:**

```
Error Message: "Trained model not found. Please retrain the model."
User Action: "Retrain Model" button enabled
System: Automatically trigger retraining
```

**Pass Criteria:** Graceful error handling, recovery option provided  
**Status:** Pending

---

#### Test Case: EC-SE-002 - Database Connection Failure

**Scenario:** MongoDB connection lost

**Expected Behavior:**

```
Error Message: "Database connection failed. Please try again."
Status Code: 503 Service Unavailable
Retry Logic: Automatic retry after 5 seconds
```

**Pass Criteria:** Error caught and reported  
**Status:** Pending

---

### 6.2 Data Edge Cases

#### Test Case: EC-DE-001 - Single Record Dataset

**Scenario:** Predict for one patient only

**Input:** Single patient record

**Expected Behavior:**

```
✓ Prediction generated without errors
✓ No statistical errors (std dev = 0 with 1 sample)
✓ Feature engineering works with single row
```

**Pass Criteria:** Handles single record gracefully  
**Status:** Pending

---

#### Test Case: EC-DE-002 - All Same Values

**Scenario:** Multiple patients with identical features

**Input:**

```
100 records all with LOS=5, Emergency=Y, Age=65+
```

**Expected Behavior:**

```
✓ Preprocessing handles zero variance features
✓ Predictions may be identical but valid
✓ Model doesn't crash on constant features
```

**Status:** Pending

---

#### Test Case: EC-DE-003 - Maximum Allowed Records

**Scenario:** Batch predict 1 million records

**Expected Behavior:**

```
✓ Process completes without memory errors
✓ Response time: < 5 minutes
✓ Results saved to file for download
```

**Pass Criteria:** Handles large batch without failure  
**Status:** Pending

---

## Performance Test Scenarios

### 7.1 Training Performance

#### Scenario: SC-PERF-001 - Model Training Speed

**Baseline:**

- Decision Tree (depth=13): < 10 seconds
- HistGradientBoosting: 30-60 seconds
- Lasso (optimized): < 20 seconds

**Test Steps:**

1. Measure training time for each model
2. Run 5-fold CV
3. Benchmark total training time

**Expected Result:**

```
Decision Tree: ~8 seconds ✓
HistGradientBoosting: ~50 seconds ✓
Lasso: ~12 seconds ✓
Total CV time: ~15-20 minutes
```

**Pass Criteria:** All within baseline  
**Status:** Pending

---

#### Scenario: SC-PERF-002 - Memory Usage During Training

**Expected Usage:**

```
Data loading: ~1.5 GB
Preprocessing: +0.5 GB
Model training: +1 GB
Peak memory: ~3 GB
```

**Pass Criteria:** Peak < 8 GB available RAM  
**Status:** Pending

---

### 7.2 Prediction Performance

#### Scenario: SC-PERF-003 - Single Prediction Latency

**Test Setup:**

1. Load trained model
2. Prepare single patient record
3. Measure prediction time

**Expected Result:**

```
Average latency: < 100 ms
95th percentile: < 150 ms
100 consecutive predictions: < 10 seconds total
```

**Pass Criteria:** Latency < 100ms  
**Status:** Pending

---

#### Scenario: SC-PERF-004 - Batch Prediction Speed

**Test Setup:**

1. Load trained model
2. Prepare batch of N records
3. Measure prediction time

**Expected Results:**
| Batch Size | Expected Time | Status |
|-----------|---------------|--------|
| 100 | < 1 second | Pending |
| 1,000 | < 5 seconds | Pending |
| 10,000 | < 30 seconds | Pending |
| 100,000 | < 3 minutes | Pending |

---

### 7.3 Model File Size

#### Scenario: SC-PERF-005 - Serialized Model Size

**Expected:**

```
best_model.joblib file size: 15-50 MB
Compression ratio: 3:1 (if compressed)
Load time: < 2 seconds
```

**Pass Criteria:** File size manageable, load time < 2s  
**Status:** Pending

---

## Regression Test Scenarios

### 8.1 Version Compatibility

#### Scenario: SC-REG-001 - Backward Compatibility

**Test:**

1. Load model from v1.0
2. Run predictions with v2.0 code
3. Verify predictions remain consistent

**Expected Outcome:**

```
Predictions identical to within 0.01% (floating-point precision)
Feature engineering produces same values
Model performance unchanged
```

**Pass Criteria:** Predictions consistent across versions  
**Status:** Pending

---

#### Scenario: SC-REG-002 - Feature Engineering Consistency

**Test:**

1. Run feature engineering on same dataset twice
2. Compare generated features

**Expected Outcome:**

```
Severity × Mortality values identical
Log transformations match exactly
DRG frequencies consistent
No random variations
```

**Pass Criteria:** Features deterministic and consistent  
**Status:** Pending

---

### 8.2 Data Processing Regression

#### Scenario: SC-REG-003 - Currency Parsing Regression

**Test:**

1. Ensure currency parsing still handles all formats
2. Test historical edge cases

**Examples:**

```
"$1,234.56" → 1234.56 ✓
"$0.00" → 0.00 ✓
"999999" → 999999 ✓
```

**Pass Criteria:** All historical cases still pass  
**Status:** Pending

---

---

## Test Execution Summary

### Overall Test Coverage:

| Category            | Test Cases | Priority | Status  |
| ------------------- | ---------- | -------- | ------- |
| Feature Engineering | 4          | HIGH     | Pending |
| Data Preprocessing  | 4          | HIGH     | Pending |
| Model Training      | 4          | HIGH     | Pending |
| Integration Tests   | 3          | CRITICAL | Pending |
| API Tests           | 2          | CRITICAL | Pending |
| Data Quality        | 4          | HIGH     | Pending |
| Model Performance   | 4          | HIGH     | Pending |
| UI Tests            | 4          | MEDIUM   | Pending |
| Error Handling      | 5          | HIGH     | Pending |
| Performance         | 5          | MEDIUM   | Pending |
| Regression          | 3          | MEDIUM   | Pending |
| **TOTAL**           | **42**     | -        | -       |

---

## Recommended Testing Timeline

1. **Phase 1 (Week 1):** Unit tests & Data preprocessing
2. **Phase 2 (Week 2):** Model training & Integration tests
3. **Phase 3 (Week 3):** API & UI testing
4. **Phase 4 (Week 4):** Performance testing & Regression

---

## Success Criteria

✓ All CRITICAL tests passing  
✓ At least 90% of HIGH priority tests passing  
✓ Model R² > 0.78 on test set  
✓ API response time < 100ms  
✓ Zero data loss or corruption  
✓ Predictions reproducible with same random_state

---

## Sign-Off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| QA Lead          | TBD  | -    | -         |
| Development Lead | TBD  | -    | -         |
| Project Manager  | TBD  | -    | -         |

---

## Document History

| Version | Date       | Author           | Changes                                  |
| ------- | ---------- | ---------------- | ---------------------------------------- |
| 1.0     | April 2026 | Development Team | Initial comprehensive test documentation |
