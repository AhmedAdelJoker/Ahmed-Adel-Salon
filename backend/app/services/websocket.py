from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Dictionary to store connections: {user_id: [WebSocket, ...]}
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def broadcast(self, message: dict, role: str = None):
        # If role is provided, only broadcast to users with that role
        # Note: This requires a way to map user_id to role in this manager 
        # or handle it at a higher level.
        for connections in self.active_connections.values():
            for connection in connections:
                await connection.send_json(message)

manager = ConnectionManager()



