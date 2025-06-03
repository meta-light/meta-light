'use client';

import { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface ChartComponentProps {
  data: ChartData;
  type?: 'line' | 'bar' | 'pie' | 'doughnut';
  title?: string;
  width?: number;
  height?: number;
  options?: any;
}

export default function ChartComponent({ 
  data, 
  type = 'line', 
  title, 
  width = 800, 
  height = 400,
  options = {}
}: ChartComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Default options
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        title: {
          display: !!title,
          text: title
        },
        legend: {
          display: true,
          position: 'top' as const
        }
      }
    };

    // Merge default options with provided options
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      plugins: {
        ...defaultOptions.plugins,
        ...options.plugins
      }
    };

    const config: ChartConfiguration = {
      type: type,
      data: data,
      options: mergedOptions
    };

    chartRef.current = new Chart(ctx, config);

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, type, title, options]);

  return (
    <div style={{ width, height, position: 'relative' }}>
      <canvas 
        ref={canvasRef}
        style={{ 
          maxWidth: '100%', 
          maxHeight: '100%',
          display: 'block'
        }}
      />
    </div>
  );
} 