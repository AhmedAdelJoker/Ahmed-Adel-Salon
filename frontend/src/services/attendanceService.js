import api from "./api";

export const getAttendance = () => api.get("/attendance");

export const registerAttendance = (data) =>
  api.post("/attendance/register", data);

export const getEmployees = () => api.get("/employees");
