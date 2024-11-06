// src/utils/memoryUnitConversion.js

export function convertGiToMi(valueInGi) {
    return valueInGi * 1024;
  }
  
  export function normalizeMemoryValue(value, unit) {
    if (unit === 'Gi') {
      return convertGiToMi(value);
    }
    return value; // 假设默认单位是 Mi
  }
  
  export function formatMemory(value, unit) {
    if (unit === 'Gi') {
      return `${value.toFixed(2)} Gi`;
    } else if (value >= 1024) {
      return `${(value / 1024).toFixed(2)} Gi`;
    }
    return `${value.toFixed(2)} Mi`;
  }