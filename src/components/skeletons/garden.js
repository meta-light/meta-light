import Head from "next/head";
import Script from 'next/script';
import { useEffect } from 'react';
import "../../app/styles/styles.css";
import "../../app/styles/LineIcons.css";

export default function garden() { // will not work until I purchase another year of service
  const sensecapKey = process.env.SENSECAP_API_KEY;
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    fetch("https://sensecap.seeed.cc/openapi/list_telemetry_data?device_eui=2CF7F1C0435002C3", {headers: {Authorization: "Basic " + btoa(sensecapKey)}})
    .then((response) => response.json())
    .then((response) => {
      console.log("Response: ", response);
      const data = response.data.list;
      const labels = [];
      const temperatureData = [];
      const humidityData = [];
      const CO2Data = [];
      for (const item of data) {
        for (let index = 0; index < data[1][0].length; index++) {
          const temperature = data[1][0][index][0];
          const temp = data[1][0][index];
          const humidity = data[1][1][index][0];
          const CO2 = data[1][2][index][0];
          const timestamp = new Date(temp[1]).toLocaleString("en-US", { timeZone: "America/Chicago" });
          labels.push(timestamp);
          temperatureData.push(temperature);
          humidityData.push(humidity);
          CO2Data.push(CO2);
        }
      }
      createChart(labels, temperatureData, humidityData, CO2Data);
    })
    .catch((error) => console.error(error));

    function createChart(labels, temperatureData, humidityData, CO2Data) {
      var ctx = document.getElementById("myChart").getContext("2d");
      var chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            { label: "Temperature (F)", data: temperatureData, fill: false, borderColor: "rgb(255, 99, 132)", tension: 0.1 },
            { label: "Humidity (%)", data: humidityData, fill: false, borderColor: "rgb(54, 162, 235)", tension: 0.1 },
            { label: "CO2 (ppm)", data: CO2Data, fill: false, borderColor: "rgb(255, 206, 86)", tension: 0.1 }
          ],
        },
        options: { scales: { y: { beginAtZero: true } } },
      });
    }
  }, []);

  return (
    <>
      <Head>
        <title>Nick Carpinito - Garden</title>
        <meta name="description" content="Garden Air Quality Stats"/>
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js"/>
      <div>
        <canvas id="myChart"></canvas>
      </div>
    </>
  );
}