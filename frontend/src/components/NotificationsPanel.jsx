import { useEffect } from 'react';
import React from "react";

export default function NotificationsPanel({ notifications }) {
  if (!notifications?.length) return null;

  


return (

    <div className="space-y-2">
      {notifications.map((n, i) => (
        <div
          key={i}
          className="bg-yellow-50 border border-yellow-300 p-3 rounded-xl text-sm font-bold"
        >
          {n}
        </div>
      ))}
    </div>
  );
}


