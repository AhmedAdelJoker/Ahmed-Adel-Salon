import { useEffect } from 'react';
import React from "react";

export default function AIInsights({ data }) {
  if (!data) return null;

  


return (

    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-2xl space-y-3">
      <div className="font-black text-lg">🤖 تحليل ذكي</div>

      {data.insights.map((i, idx) => (
        <div key={idx} className="text-sm font-bold">
          {i}
        </div>
      ))}

      <div className="pt-3 border-t text-sm font-black">
        📈 الربح المتوقع: {data.predicted.toFixed(2)}
      </div>
    </div>
  );
}


