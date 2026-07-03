import fs from 'fs/promises';
import path from 'path';
import Tesseract from 'tesseract.js';
import fsSync from 'fs';
import pdfjs from 'pdfjs-dist';
import { readFileSync, writeFileSync } from 'fs';

export interface Fund {
    name: string;
    type: string;
    status: string;
    sector: string;
    website: string;
    jobBoard: string;
    investments: string;
    x: string;
    linkedin: string;
    email: string;
    contact: string;
    contactLinkedin: string;
    contactTwitter: string;
}

export function parseCSV(csvContent: string): Fund[] {
    const lines = csvContent.split('\n');
    const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
    return dataLines.map(line => {
        const values = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g)?.map(value => {return value.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();}) || [];
        return {
            name: values[0] || '',
            type: values[1] || '',
            status: values[2] || '',
            sector: values[3] || '',
            website: values[4] || '',
            jobBoard: values[5] || '',
            investments: values[6] || '',
            x: values[7] || '',
            linkedin: values[8] || '',
            email: values[9] || '',
            contact: values[10] || '',
            contactLinkedin: values[11] || '',
            contactTwitter: values[12] || ''
        };
    });
}

export interface FundEntry {
    id: number;
    name: string;
    description: string;
    rounds?: string[];
    portfolio?: string[];
    geography?: string;
    contact?: string;
}

export function parseFundsMarkdown(markdown: string): FundEntry[] {
    const fundMap = new Map<number, Partial<FundEntry>>();
    const lines = markdown.split('\n');
    lines.forEach(line => {
      const baseMatch = line.match(/^(\d+)\s+(.*?)$/);
      if (!baseMatch) return;
      const id = parseInt(baseMatch[1]);
      const content = baseMatch[2].trim();
      if (!fundMap.has(id)) {fundMap.set(id, { id });}
      const fund = fundMap.get(id)!;
      if (content.includes('https://') || content.includes('E-mail:')) {fund.contact = content;} 
      else if (content.startsWith('Global') || content.startsWith('US and')) {fund.geography = content;} 
      else if (content.includes('Pre-seed') || content.includes('Seed') || content.includes('Series')) {fund.rounds = content.split(' ').filter(r => r.length > 0);} 
      else if (content.includes(',')) {fund.portfolio = content.split(',').map(p => p.trim());} 
      else {const parts = content.split(/\s{2,}/); if (parts.length >= 2) {fund.name = parts[0].trim(); fund.description = parts.slice(1).join(' ').trim();}}
    });
    const funds = Array.from(fundMap.values()).filter(fund => fund.name && fund.description) as FundEntry[];
    return funds;


}

export interface PreparedDocument {content: string; tokens: number; source: string; embedding: number[];}
export interface Document {content: string; name: string; path: string;}

export function prepareDocumentForOpenAI(doc: Document): PreparedDocument {
  const estimatedTokens = Math.ceil(doc.content.length / 4);
  return {content: `Document: ${doc.name}\n\n${doc.content}`, tokens: estimatedTokens, source: doc.path, embedding: []};
}

export async function getAllDocuments(directoryPath: string): Promise<Document[]> {
  const documents: Document[] = [];
  async function processDirectory(currentPath: string) {
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(currentPath, file.name);
      if (file.isDirectory()) {await processDirectory(fullPath);} 
      else if (file.name.endsWith('.md')) {const content = await fs.readFile(fullPath, 'utf-8'); documents.push({content, name: file.name, path: fullPath});}
    }
  }
  await processDirectory(directoryPath);
  return documents;
}

export interface ConversionResult {
  markdown: string;
  sourcePath: string;
  success: boolean;
  error?: string;
}
  
export interface ConversionOptions {
  includeHeaders?: boolean;
  preserveLinks?: boolean;
  outputDir?: string;
}

export class ImageConverter {
  async convertToMarkdown(filePath: string, options: ConversionOptions = {}): Promise<ConversionResult> {
    try {
      const result = await Tesseract.recognize(filePath, 'eng');
      const text = result.data.text;
      const markdown = this.formatToMarkdown(text, options);
      return {markdown, sourcePath: filePath, success: true};
    } 
    catch (error) {return {markdown: '', sourcePath: filePath, success: false, error: error instanceof Error ? error.message : 'Unknown error'};}
  }
  private formatToMarkdown(text: string, options: ConversionOptions): string {return text;}
} 

export class DocumentConverter {
  public pdfConverter: PdfConverter;
  private imageConverter: ImageConverter;
  constructor() {this.pdfConverter = new PdfConverter(); this.imageConverter = new ImageConverter();}
  async convertDirectory(dirPath: string, options: ConversionOptions = {}): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const ext = path.extname(file).toLowerCase();
        let result: ConversionResult;
        if (ext === '.pdf') {result = await this.pdfConverter.convertToMarkdown(filePath, options);} 
        else if (['.png', '.jpg', '.jpeg'].includes(ext)) {result = await this.imageConverter.convertToMarkdown(filePath, options);} 
        else {continue;}
        if (result.success && options.outputDir) {
          const outputPath = path.join(options.outputDir, `${path.basename(file, path.extname(file))}.md`);
          await fs.writeFile(outputPath, result.markdown);
        }
        results.push(result);
      }
    } 
    catch (error) {console.error('Error processing directory:', error);}
    return results;
  }
}

export function cleanMarkdown(input: string): string {
  let text = input
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/(\w+)\s*\.\s*(\w+)\s*\/\s*/g, '$1.$2/')
      .replace(/([A-Z])\s+([a-z]{2})/g, '$1$2')
      .replace(/@\s*([a-zA-Z0-9_]+)/g, '@$1')
      .replace(/([?&])\s*([a-zA-Z0-9]+)\s*=/g, '$1$2=')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/(\w+)\s*=\s*([a-zA-Z0-9]+)/g, '$1=$2');
  let paragraphs = text.split('\n\n');
  paragraphs = paragraphs.map(paragraph => {if (!paragraph.trim()) return ''; return paragraph.split('\n').map(line => line.trim()).join(' ').trim();});
  paragraphs = paragraphs.map(p => p.replace(/\s+\d+\/\d+\s*$/, '').replace(/\s+https?:\/\/[^\s]+\s*$/, ''));
  return paragraphs.filter(p => p).join('\n\n');
} 
  
export function normalizeMarkdown(content: string): string {
  let lines = content.split('\n');
  let normalizedLines: string[] = [];
  let currentParagraph: string[] = [];
  function processParagraph() {
      if (currentParagraph.length > 0) {
          let paragraph = currentParagraph.join(' ').trim();
          let sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
          let normalizedParagraph = sentences.map(sentence => {sentence = sentence.trim(); return sentence.charAt(0).toUpperCase() + sentence.slice(1);}).join(' ');
          normalizedLines.push(normalizedParagraph);
          currentParagraph = [];
      }
  }
  for (let line of lines) {
      line = line.trim();
      if (line.match(/^#+ /)) {processParagraph(); if (!line.startsWith('##')) {line = '#' + line;} normalizedLines.push(line); continue;}
      if (line === '') {processParagraph(); normalizedLines.push(''); continue;}
      currentParagraph.push(line);
  }
  processParagraph();
  return normalizedLines.join('\n');
}

export function processFile(filePath: string) {
  try {
      const content = readFileSync(filePath, 'utf8');
      const normalizedContent = normalizeMarkdown(content);
      const backupPath = filePath + '.backup';
      writeFileSync(backupPath, content);
      writeFileSync(filePath, normalizedContent);
      console.log(`Successfully processed ${filePath}`);
  } 
  catch (error) {console.error(`Error processing ${filePath}:`, error);}
}

export class PdfConverter {
  async convertToMarkdown(filePath: string, options: ConversionOptions = {}): Promise<ConversionResult> {
    try {
      const doc = await pdfjs.getDocument(filePath).promise;
      let fullText = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      const markdown = this.formatToMarkdown(fullText, options);
      return {markdown, sourcePath: filePath, success: true};
    } 
    catch (error) {return {markdown: '', sourcePath: filePath, success: false, error: error instanceof Error ? error.message : 'Unknown error'};}
  }
  private formatToMarkdown(text: string, options: ConversionOptions): string {
    let markdown = text;
    if (options.includeHeaders) {
      const lines = markdown.split('\n');
      markdown = lines.map(line => {if (line.length > 0 && line === line.toUpperCase()) {return `## ${line}\n`;} return line;}).join('\n');
    }
    return markdown;
  }
}

export async function buildJSONL(directory: string) {
  const markdownDir = path.join(__dirname, '..', directory);
  const outFile = path.join(__dirname, 'output.jsonl');
  const mdFiles = getMarkdownFiles(markdownDir);
  const outputStream = fsSync.createWriteStream(outFile, { flags: 'w' });
  for (const filePath of mdFiles) {
      const content = fsSync.readFileSync(filePath, 'utf8');
      const jsonObject = {id: filePath, content: content};
      outputStream.write(JSON.stringify(jsonObject) + '\n');
  }
  outputStream.end();
  console.log(`JSONL file created at: ${outFile}`);
}

export function convertTweetsToJSONL(inputFilePath: string, outFilePath: string, systemContent: string, userContent: string) {
    const fileData = readFileSync(inputFilePath, 'utf8');
    const tweets: any[] = JSON.parse(fileData);
    const jsonlEntries: string[] = tweets.map(tweet => {
      const tweetContent: string = (tweet.content || tweet.text || '').trim();
      if (!tweetContent) return null;
      const entry = {messages: [{role: "system", content: systemContent}, {role: "user", content: userContent}, {role: "assistant", content: tweetContent}]};
      return JSON.stringify(entry);
    }).filter((line): line is string => line !== null);
    writeFileSync(outFilePath, jsonlEntries.join('\n'), 'utf8');
    console.log(`Converted ${jsonlEntries.length} tweets to ${outFilePath}`);
}

export function getMarkdownFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fsSync.readdirSync(dir);
    list.forEach((fileOrDir: string) => {
        const fullPath = path.join(dir, fileOrDir);
        if (fsSync.statSync(fullPath).isDirectory()) {results = results.concat(getMarkdownFiles(fullPath));} 
        else if (fullPath.endsWith('.md')) {results.push(fullPath);}
    });
    return results;
}
  
export function splitMarkdown(content: string, maxTokens: number = 4000): string[] {
    const approxCharsPerToken = 4;
    const maxChars = maxTokens * approxCharsPerToken;
    const chunks: string[] = [];
    let start = 0;
    while (start < content.length) {
      let end = start + maxChars;
      if (end < content.length) {const lastNewLine = content.lastIndexOf('\n', end); if (lastNewLine > start) {end = lastNewLine;}}
      const chunk = content.slice(start, end).trim();
      if (chunk.length > 0) {chunks.push(chunk);}
      start = end;
    }
    return chunks;
}

