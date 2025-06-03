import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get sensor credentials from environment variables
    const sensecapEUI = process.env.SENSECAP_EUI;
    const sensecapKey = process.env.SENSECAP_KEY;

    if (!sensecapEUI || !sensecapKey) {
      return NextResponse.json(
        { error: 'Sensor credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch data from SenseCap API
    const response = await fetch(
      `https://sensecap.seeed.cc/openapi/list_telemetry_data?device_eui=${sensecapEUI}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(sensecapKey).toString('base64')}`
        }
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch sensor data' },
        { status: response.status }
      );
    }

    const apiResponse = await response.json();
    console.log("SenseCap Response: ", apiResponse);

    const data = apiResponse.data?.list;
    if (!data || !Array.isArray(data) || data.length < 2) {
      return NextResponse.json(
        { error: 'Invalid sensor data format' },
        { status: 400 }
      );
    }

    // Process the sensor data
    const labels: string[] = [];
    const temperatureData: number[] = [];
    const humidityData: number[] = [];
    const CO2Data: number[] = [];

    try {
      // Navigate the nested data structure
      const sensorReadings = data[1];
      if (!sensorReadings || !Array.isArray(sensorReadings) || sensorReadings.length < 3) {
        throw new Error('Incomplete sensor data');
      }

      const tempReadings = sensorReadings[0]; // Temperature readings
      const humidityReadings = sensorReadings[1]; // Humidity readings  
      const co2Readings = sensorReadings[2]; // CO2 readings

      // Process each reading
      for (let index = 0; index < tempReadings.length; index++) {
        if (tempReadings[index] && humidityReadings[index] && co2Readings[index]) {
          const temperature = tempReadings[index][0];
          const humidity = humidityReadings[index][0];
          const CO2 = co2Readings[index][0];
          const timestamp = new Date(tempReadings[index][1]).toLocaleString("en-US", { 
            timeZone: "America/Chicago" 
          });

          labels.push(timestamp);
          temperatureData.push(temperature);
          humidityData.push(humidity);
          CO2Data.push(CO2);
        }
      }
    } catch (processingError) {
      console.error('Error processing sensor data:', processingError);
      return NextResponse.json(
        { error: 'Error processing sensor data', details: processingError instanceof Error ? processingError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Return processed data
    return NextResponse.json({
      success: true,
      data: {
        labels,
        datasets: [
          {
            label: "Temperature (F)",
            data: temperatureData,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.1)",
            fill: false,
            tension: 0.1
          },
          {
            label: "Humidity (%)",
            data: humidityData,
            borderColor: "rgb(54, 162, 235)",
            backgroundColor: "rgba(54, 162, 235, 0.1)",
            fill: false,
            tension: 0.1
          },
          {
            label: "CO2 (ppm)",
            data: CO2Data,
            borderColor: "rgb(255, 206, 86)",
            backgroundColor: "rgba(255, 206, 86, 0.1)",
            fill: false,
            tension: 0.1
          }
        ]
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        recordCount: labels.length
      }
    });

  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 