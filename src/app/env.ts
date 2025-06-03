import dotenv from "dotenv";

dotenv.config();

export const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
export const UNDERDOG_API_KEY = process.env.NEXT_PUBLIC_UNDERDOG_API_KEY;
export const OMDB_API_KEY = process.env.NEXT_PUBLIC_OMDB_API_KEY;

export const terminalCSS = 'https://unpkg.com/terminal.css@0.7.2/dist/terminal.min.css';