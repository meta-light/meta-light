"use client";
import React from 'react';
import "../styles/tailwind.css";

const videos = [
  { title: "La La Land", videoId: "9me9FDUBFr0" },
  { title: "Still DRE", videoId: "zs6LGSVyurE" },
  { title: "Fly Me to the Moon", videoId: "Wa8fAoJmjQA" },
  { title: "In The End", videoId: "JyqYmdMCD5g" },
  { title: "Heat/Snow Miser", videoId: "b75ThgIuiSk" },
  { title: "Numb", videoId: "cPOMu6Q26vg" },
  { title: "Zombie", videoId: "dPrxZ8TEXH4" },
  { title: "Stairway to Heaven", videoId: "SGMoa6GMCjc" },
  { title: "The Night We Met", videoId: "fHPYqOdlNgA" },
  { title: "Viva La Vita", videoId: "0ewwWK9_-iE" }
];

export default function PainoPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-500">Paino Tutorials</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {videos.map((video, index) => (
          <div key={index} className=" rounded p-4">
            <h2 className="text-xl text-black font-semibold mb-2">{video.title}</h2>
            <div className="w-full h-[315px] relative">
              <iframe 
                src={`https://www.youtube.com/embed/${video.videoId}`} 
                title={video.title} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 