import React, { useState } from "react";

const RiskForm = () => {
  const [form, setForm] = useState({
    age: "",
    bmi: "",
    smoker: "no",
    visits: "",
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Prediction will be calculated once backend is connected");
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <input name="age" placeholder="Age" onChange={handleChange} />
      <input name="bmi" placeholder="BMI" onChange={handleChange} />
      <input name="visits" placeholder="Hospital Visits per Year" onChange={handleChange} />

      <select name="smoker" onChange={handleChange}>
        <option value="no">Non-Smoker</option>
        <option value="yes">Smoker</option>
      </select>

      <button type="submit">Predict Cost</button>
    </form>
  );
};

export default RiskForm;
