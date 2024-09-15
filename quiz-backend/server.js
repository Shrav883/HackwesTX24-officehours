const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
import OpenAI from "openai";
const mammoth = require('mammoth');  // For Word documents
const pdfParse = require('pdf-parse');  // For PDF documents

const app = express();
app.use(bodyParser.json());

// Set up OpenAI configuration
const openai = new OpenAI({
    organization: "org-Lh56UhGSdhwCJS4PVOxk6f6y",
    project: "$PROJECT_ID",
});

// Function to read a PDF file and return the text content
async function readPdfContent(pdfFilePath) {
    const dataBuffer = fs.readFileSync(pdfFilePath);
    const pdfData = await pdfParse(dataBuffer);
    return pdfData.text;  // Return the text content of the PDF
}

// Function to read a Word document and return the text content
async function readWordContent(docxFilePath) {
    const result = await mammoth.extractRawText({ path: docxFilePath });
    return result.value;  // Return the text content of the Word document
}

// Route to generate quiz questions based on the content of a file (PDF or Word)
app.get('/generate-quiz', async (req, res) => {
    let documentText;

    // Check if the document is a PDF or Word file
    const documentPath = path.join(__dirname, 'document.pdf');  // Path to your document
    const fileExtension = path.extname(documentPath).toLowerCase();

    if (fileExtension === '.pdf') {
        // Read content from a PDF file
        documentText = await readPdfContent(documentPath);
    } else if (fileExtension === '.docx') {
        // Read content from a Word document
        documentText = await readWordContent(documentPath);
    } else {
        return res.status(400).json({ error: 'Unsupported file format. Please use PDF or Word documents.' });
    }

    // Use GPT-4 API to generate questions based on the document content
    const prompt = `Generate 5 True/False questions based on the following content: ${documentText}`;
    
    const gptResponse = await openai.createCompletion({
        model: 'gpt-4',
        prompt: prompt,
        max_tokens: 150
    });

    const questions = parseQuestionsFromResponse(gptResponse.data.choices[0].text);

    res.json({ questions });
});

// Function to parse GPT-4's response into questions
function parseQuestionsFromResponse(responseText) {
    const questions = responseText.split('\n').filter(q => q.trim()).map(q => ({ text: q }));
    return questions;
}

// Route to submit quiz answers and grade them
app.post('/submit-quiz', async (req, res) => {
    const { answers } = req.body;
    const prompt = `The following are the user's answers to a True/False quiz. Please grade them. Answers: ${JSON.stringify(answers)}`;

    const gptResponse = await openai.createCompletion({
        model: 'gpt-4',
        prompt: prompt,
        max_tokens: 50
    });

    const score = extractScoreFromResponse(gptResponse.data.choices[0].text);

    saveGradeToCSV(score);

    res.json({ score });
});

// Function to extract the score from GPT-4's response
function extractScoreFromResponse(responseText) {
    const match = responseText.match(/You scored (\d+)\/(\d+)/);  // Correct backslash usage
    return match ? parseInt(match[1], 10) : 0;
}

// Function to save grade to a CSV file
function saveGradeToCSV(score) {
    const csvLine = `User,${new Date().toISOString()},${score}\n`;
    fs.appendFileSync('grades.csv', csvLine);
}

// Start the server
app.listen(3000, () => {
    console.log('Quiz API is running on http://localhost:3000');
});
