import { api } from "./api";

export const barberPresenceService = {
  checkIn: async () => {
    const response = await api.post("/barber-presence/check-in");
    return response.data;
  },
  checkOut: async () => {
    const response = await api.post("/barber-presence/check-out");
    return response.data;
  },
  current: async () => {
    const response = await api.get("/barber-presence/current");
    return response.data;
  },
};
