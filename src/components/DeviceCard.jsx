import React from "react";
import { Laptop, Smartphone, Tablet, Monitor, ArrowLeftRight } from "lucide-react";

export default function DeviceCard({ label, name, iconType }) {
  const renderIcon = () => {
    switch (iconType) {
      case "smartphone":
        return <Smartphone size={20} />;
      case "tablet":
        return <Tablet size={20} />;
      case "monitor":
        return <Monitor size={20} />;
      case "remote":
        return <ArrowLeftRight size={20} />;
      case "laptop":
      default:
        return <Laptop size={20} />;
    }
  };

  return (
    <div className="device-card">
      <div className="device-icon-box">{renderIcon()}</div>
      <div className="device-meta">
        <div className="device-label">{label}</div>
        <div className="device-name">{name}</div>
      </div>
    </div>
  );
}
