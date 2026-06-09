import React, { useState, useEffect } from 'react';

export default function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  
  const pad = (num) => num.toString().padStart(2, '0');

  return (
    <div className="digital-clock-fixed">
      {/* Fake Screws for physical casing look */}
      <div className="clock-screw top-left" />
      <div className="clock-screw top-right" />
      <div className="clock-screw bottom-left" />
      <div className="clock-screw bottom-right" />
      
      <div className="clock-display-wrapper">
        <div className="clock-time-bg">88<span className="colon" style={{opacity: 1}}>:</span>88</div>
        <div className="clock-time">
          {pad(hours)}<span className="colon">:</span>{pad(minutes)}
        </div>
      </div>
    </div>
  );
}
