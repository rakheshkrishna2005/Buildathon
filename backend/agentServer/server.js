'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

const MONGODB_URI = process.env.MONGODB_URI;
console.log('Connecting to MongoDB...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  
  mongoose.connection.db.listCollections().toArray((err, collections) => {
    if (err) {
      console.error('Error listing collections:', err);
    } else {
      console.log('Available collections:', collections.map(c => c.name).join(', '));
      
      const hasConversations = collections.some(c => c.name === 'conversations');
      console.log('Conversations collection exists:', hasConversations);
    }
  });
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const interviewSchema = new mongoose.Schema({
  candidateId: String,
  candidateEmail: String,
  candidateName: String,
  interviewId: String,
  transcript: [{ role: String, content: String }],
  status: { type: String, enum: ['pending', 'completed', 'evaluated'], default: 'pending' },
  result: { type: String, enum: ['passed', 'failed', 'pending'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Interview = mongoose.model('Interview', interviewSchema, 'conversations');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

app.post('/generate-interview-link', async (req, res) => {
  try {
    const { candidateId, candidateEmail, candidateName } = req.body;
    
    if (!candidateId || !candidateEmail) {
      return res.status(400).json({
        success: false,
        error: 'Candidate ID and email are required'
      });
    }

    const interviewId = uuidv4();
    
    const interview = new Interview({
      candidateId,
      candidateEmail,
      candidateName,
      interviewId,
      status: 'pending',
      result: 'pending'
    });
    
    await interview.save();
    
    res.json({
      success: true,
      interviewId,
      interviewLink: `${process.env.FRONTEND_URL}/interview/${interviewId}`
    });
  } catch (error) {
    console.error('Error generating interview link:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/send-mail', async (req, res) => {
  try {
    console.log('Mail request body:', req.body);
    const { to, subject, text, candidateId, candidateName, includeInterview } = req.body;
    
    const validationErrors = [];
    if (!to || typeof to !== 'string' || !to.trim()) validationErrors.push('email address');
    if (!subject || typeof subject !== 'string' || !subject.trim()) validationErrors.push('subject');
    if (!text || typeof text !== 'string' || !text.trim()) validationErrors.push('message');
    
    if (validationErrors.length > 0) {
      const errorMessage = `Missing required fields: ${validationErrors.join(', ')}`;
      console.log('Validation failed:', errorMessage);
      return res.status(400).json({ 
        success: false, 
        error: errorMessage
      });
    }
    
    const actualCandidateId = candidateId || uuidv4();

    let interviewId = null;
    let interviewLink = null;
    let emailText = text;
    
    if (includeInterview) {
      interviewId = uuidv4();
      interviewLink = `${process.env.FRONTEND_URL}/interview/${interviewId}`;
      
      const interview = new Interview({
        candidateId: actualCandidateId,
        candidateEmail: to,
        candidateName: candidateName || 'Candidate',
        interviewId,
        status: 'pending',
        result: 'pending'
      });
      
      await interview.save();

      emailText = `${text}\n\nPlease click the following link to start your voice interview: ${interviewLink}\n\nThank you!`;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: emailText
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log("Message sent: %s", info.messageId);
    
    const response = {
      success: true,
      messageId: info.messageId,
      candidateId: actualCandidateId
    };
    
    if (interviewId) {
      response.interviewId = interviewId;
      response.interviewLink = interviewLink;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/save-transcript', async (req, res) => {
  try {
    const { interviewId, transcript } = req.body;
    
    console.log('Saving transcript for interview:', interviewId);
    console.log('Transcript length:', transcript ? transcript.length : 0);
    
    if (!interviewId || !transcript) {
      return res.status(400).json({
        success: false,
        error: 'Interview ID and transcript are required'
      });
    }
    
    console.log('Looking for interview with ID:', interviewId);
    
    let interview = await Interview.findOne({ interviewId });
    
    if (!interview) {
      console.log('Interview not found in first attempt, trying again...');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      interview = await Interview.findOne({ interviewId });
      
      if (!interview) {
        console.error('Interview still not found with ID:', interviewId);
        
        console.log('Creating a new interview record for this ID');
        interview = new Interview({
          candidateId: 'auto-generated',
          candidateEmail: 'auto@example.com',
          candidateName: 'Auto Generated',
          interviewId: interviewId,
          status: 'pending',
          result: 'pending'
        });
        
        try {
          await interview.save();
          console.log('Created new interview record with ID:', interviewId);
        } catch (saveError) {
          console.error('Error creating new interview record:', saveError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create interview record: ' + saveError.message
          });
        }
      } else {
        console.log('Found interview on second attempt');
      }
    }
    
    console.log('Found interview for candidate:', interview.candidateName);
    
    interview.transcript = transcript;
    interview.status = 'completed';
    await interview.save();
    console.log('Saved transcript to database');
    
    console.log('Starting interview evaluation...');
    const result = await evaluateInterview(transcript);
    console.log('Evaluation result:', result);
    
    interview.result = result;
    interview.status = 'evaluated';
    await interview.save();
    console.log('Updated interview with evaluation result');
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error saving transcript:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function evaluateInterview(transcript) {
  try {
    if (!transcript || transcript.length === 0) {
      console.error('Empty transcript provided for evaluation');
      return 'failed';
    }
    
    const transcriptText = transcript.map(t => `${t.role}: ${t.content}`).join('\n');
    console.log('Prepared transcript text for evaluation, length:', transcriptText.length);
    
    const prompt = `
      You are an expert HR evaluator. Please analyze the following job interview transcript and determine if the candidate passed or failed.
      Focus on:
      - Communication skills
      - Technical knowledge
      - Problem-solving abilities
      - Cultural fit
      
      Transcript:
      ${transcriptText}
      
      Based on this transcript, did the candidate pass or fail the interview? 
      Answer with only "passed" or "failed".
    `;
    
    console.log('Calling Gemini API for evaluation...');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = result.response.text().toLowerCase();
    console.log('Raw Gemini response:', response);
    
    const finalResult = response.includes('pass') ? 'passed' : 'failed';
    console.log('Final evaluation result:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('Error evaluating interview:', error);
    console.error('Error details:', error.message);
    return 'failed';
  }
}

app.get('/check-interview/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;
    
    if (!interviewId) {
      return res.status(400).json({
        success: false,
        error: 'Interview ID is required'
      });
    }
    
    console.log('Checking if interview exists with ID:', interviewId);
    
    const interview = await Interview.findOne({ interviewId });
    
    if (interview) {
      console.log('Interview found:', interview.candidateName);
      return res.json({
        success: true,
        exists: true,
        interview: {
          candidateName: interview.candidateName,
          status: interview.status,
          result: interview.result
        }
      });
    } else {
      console.log('Interview not found, creating a new one');
      
      const newInterview = new Interview({
        candidateId: 'auto-generated',
        candidateEmail: 'auto@example.com',
        candidateName: 'Auto Generated',
        interviewId,
        status: 'pending',
        result: 'pending'
      });
      
      await newInterview.save();
      
      return res.json({
        success: true,
        exists: false,
        created: true,
        interview: {
          candidateName: newInterview.candidateName,
          status: newInterview.status,
          result: newInterview.result
        }
      });
    }
  } catch (error) {
    console.error('Error checking interview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/candidates', async (req, res) => {
  try {
    const candidates = await Interview.find({}, {
      candidateName: 1,
      candidateEmail: 1,
      status: 1,
      result: 1,
      _id: 0
    });
    
    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    const interviewCount = await Interview.countDocuments();
    
    res.json({ 
      status: 'Mail server is running',
      database: dbStatus,
      interviews: interviewCount
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Mail server running on port ${PORT}`);
});