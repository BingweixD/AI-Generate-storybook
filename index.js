require('dotenv').config();
const express = require('express');
const OpenAI = require("openai");
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');

// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Make sure to load the .env file if you're using dotenv
const DALLE_API_KEY = process.env.DALLE_API_KEY;
const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = 3080;


const generateImage = async (story, styleHints, previousAttributes, referenceImages = []) => {
    try {
        let prompt = `${story}.`; 
        if (styleHints) {
            prompt += ` The style should be consistent with ${styleHints}, influenced by [specific artists, art movements, or styles].`;
        }
        if (previousAttributes) {
            prompt += ` This image should include ${previousAttributes}, maintaining the color palette and character design of previous images.`;
        }
        if (referenceImages.length > 0) {
            prompt += ` Reference images are provided to maintain consistency.`;
        }
        prompt += "summerize the story and make sure there is no words in the image";

        const response = await axios.post('https://api.openai.com/v1/images/generations', {
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            // If the API supports directly attaching reference images or their IDs, add them here
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DALLE_API_KEY}`
            }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
            const imageUrl = response.data.data[0].url;
            console.log("Generated Image URL:", imageUrl);
            return imageUrl;
        } else {
            console.log("API response did not contain any images. Response:", response.data);
            return '';
        }
    } catch (error) {
        console.error("An error occurred while generating the image:", error.response ? error.response.data : error.message);
        return '';
    }
};


const callApi = async (userMessage, chatLog) => {
    try {
        const startTime = Date.now();

        // Validate userMessage
        if (!userMessage || typeof userMessage !== 'string') {
            console.error("Invalid user message:", userMessage);
            return 'Invalid user message.';
        }

        // Validate chatLog
        if (!Array.isArray(chatLog)) {
            console.error("Invalid chat log:", chatLog);
            return 'Invalid chat log.';
        }

        // Map roles in chatLog ('me' to 'user' and 'gpt' to 'assistant')
        const formattedMessages = chatLog.map(msg => ({
            role: msg.role === 'me' ? 'user' : (msg.role === 'gpt' ? 'assistant' : msg.role),
            content: msg.message || msg.content || ''
        }));

        // Validate formattedMessages
        const isValid = formattedMessages.every(msg => typeof msg.content === 'string');
        if (!isValid) {
            console.error("Invalid formatted message:", formattedMessages);
            return 'Invalid input data.';
        }

        // Add the latest user message to the formattedMessages array
        formattedMessages.push({ role: 'user', content: userMessage });

        // Debug log
        console.log('Formatted Messages:', formattedMessages);

        const chatCompletion = await openai.chat.completions.create({
            model: "ft:gpt-3.5-turbo-1106:personal::8hke3Plj",
            messages: formattedMessages.concat([{role: 'system', content: 'Please focus on helping the user create a story. Tell user that it is not related to story creation and get back in creating children story.'}]),
            max_tokens: 1000
        });
        const endTime = Date.now(); // Record end time
        const duration = endTime - startTime; // Calculate duration

        console.log("OpenAI API Response:", JSON.stringify(chatCompletion, null, 2));
        console.log(`API call duration: ${duration}ms`); // Log the duration

        if (chatCompletion && chatCompletion.choices && chatCompletion.choices.length > 0) {
            const choice = chatCompletion.choices[0];
            if (choice && choice.message && choice.message.content) {
                const content = choice.message.content;
                console.log('Content:', content);
                return content;
            } else {
                console.error("No content in response:", chatCompletion);
                return 'An error occurred while fetching data.';
            }
        } else {
            console.error("Invalid or incomplete response from OpenAI API:", chatCompletion);
            return 'An error occurred while fetching data.';
        }
    } catch (error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        return 'An error occurred while fetching data.';
    }
};


app.post('/', async (req, res) => {
    try {
        const { userMessage, chatLog } = req.body;
        console.log('Received user message:', userMessage, chatLog);

        // Step 1: Call the API to get the story or conversation
        const story = await callApi(userMessage, chatLog);
        if (!story || story.startsWith('Invalid')) {
            console.error("Failed to generate story:", response);
            return res.status(400).json({ error: 'Failed to generate story.' });
        }

        // // Step 2: Summarize the story/conversation
        // const summary = await summarizeStory(response);
        // if (!summary || summary.startsWith('Invalid')) {
        //     console.error("Failed to summarize the story:", summary);
        //     return res.status(400).json({ error: 'Failed to summarize the story.' });
        // }

        // // Step 3: generate an image based on the summary
        // const imageUrl = await generateImage(story);
        // if (!imageUrl) {
        //     console.error("Failed to generate an image.");
        //     return res.status(400).json({ error: 'Failed to generate an image.' });
        // }

        // Include the image URL if you're using image generation
        res.json({ message: story});
    } catch (error) {
        console.error("Error handling request:", error);
        res.status(500).json({ error: error.message });
    }
});

// Near the bottom of your backend file, before app.listen()

app.post('/generate-image', async (req, res) => {
    const { prompt, styleHints, previousAttributes } = req.body;
    console.log('Received prompt for image generation:', prompt);

    try {
        const imageUrl = await generateImage(prompt, styleHints, previousAttributes);
        if (!imageUrl) {
            console.error("Failed to generate image.");
            return res.status(400).json({ error: 'Failed to generate an image.' });
        }

        res.json({ imageUrl });
    } catch (error) {
        console.error("Error handling image generation request:", error);
        res.status(500).json({ error: error.message });
    }
});
function getNextImageUrl(chatLog, currentIndex, usedImageUrls) {
    for (let i = currentIndex + 1; i < chatLog.length; i++) {
        if (chatLog[i].message.startsWith('Image URL: ') && !usedImageUrls.has(chatLog[i].message)) {
            usedImageUrls.add(chatLog[i].message);
            return chatLog[i].message.replace('Image URL: ', '');
        }
    }
    return null; // Return null if there's no image URL after the current text entry.
}
app.post('/generate-pdf', async (req, res) => {
    const { chatLog, requestedPages } = req.body;

    const doc = new PDFDocument();
    const buffers = [];
    let usedImageUrls = new Set();
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment;filename=storybook.pdf',
        }).end(pdfData);
    });

    // Sort and select text responses
    let selectedTextResponses = chatLog.filter(entry => entry.role === 'gpt' && !entry.message.startsWith('Image URL: '))
    
                                       .map((entry, index) => ({ ...entry, originalIndex: index }))
                                       .sort((a, b) => b.message.length - a.message.length)
                                       .slice(0, requestedPages)
                                       .sort((a, b) => a.originalIndex - b.originalIndex);

    // Process each selected text response and fetch its corresponding image
    for (const response of selectedTextResponses) {
        // Add text to the PDF
        doc.addPage();
        doc.font('Times-Roman').fontSize(14).fillColor('blue');
        doc.text(response.message, {
            paragraphGap: 5,
            indent: 20,
            align: 'justify',
            columns: 1,
        });
        // Fetch the image associated with this text entry
        let imageUrl = getNextImageUrl(chatLog, response.originalIndex, usedImageUrls); // Pass usedImageUrls here

        // Check if an image URL was returned and has not been used already.
        if (imageUrl) {
            try {
                const imageResponse = await fetch(imageUrl);
                if (imageResponse.ok) {
                    const imageBuffer = await imageResponse.buffer();
                    // Add the image on a new page in the PDF.
                    doc.addPage().image(imageBuffer, { fit: [500, 500], align: 'center', valign: 'center' });
                } else {
                    console.error("Failed to load image for PDF:", imageResponse.status);
                }
            } catch (error) {
                console.error("Error fetching image for PDF:", error);
            }
        }
    }
    // Finalize the PDF
    doc.end();
});




app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
