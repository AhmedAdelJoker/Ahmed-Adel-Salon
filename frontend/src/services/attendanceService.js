import api from "./api";

export const getAttendance = () => api.get("/barber-presence/logs");

export const registerAttendance = (data) =>
  api.post("/barber-presence/register", data);

export const getEmployees = () => api.get("/employees");
