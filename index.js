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

// Function to summarize the story
const summarizeWithChatGPT = async (text) => {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/completions',
            {
                model: 'text-davinci-003', // Adjust according to your OpenAI plan and available models
                prompt: `Summarize this to under 1000 characters:\n\n${text}`,
                max_tokens: 300, // Adjust based on your needs
                temperature: 0.7,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error("Error in summarization:", error);
        throw new Error("Failed to summarize the text.");
    }
};




const generateImage = async (story) => {
    try {
        // Replace 'process.env.OPENAI_API_KEY' with your actual OpenAI API key
        const response = await axios.post('https://api.openai.com/v1/images/generations', {
            model: "dall-e-3",
            prompt: `${story}. There should be no text in the image.`,
            n: 1,
            size: "1024x1024",
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DALLE_API_KEY}`
            }
        });

        // Check if the response contains the image data
        if (response.data && response.data.data && response.data.data.length > 0) {
            const imageUrl = response.data.data[0].url; // Extract the image URL
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

// const mainProcess = async (inputText) => {
//     try {
//         let textForImageGeneration = inputText;

//         // Check if the text exceeds 1000 characters
//         if (inputText.length > 1000) {
//             console.log("Text exceeds 1000 characters, summarizing...");
//             textForImageGeneration = await summarizeWithChatGPT(inputText);
//         }

//         // Generate image with DALL-E
//         const imageUrl = await generateImage(textForImageGeneration);
//         console.log(`Image generated: ${imageUrl}`);
//         return imageUrl;
//     } catch (error) {
//         console.error("Error in main process:", error);
//         return null;
//     }
// };
// const longText = "Imagine a long text here over 1000 characters..."; // Your actual text here
// mainProcess(longText)
//     .then(imageUrl => {
//         if (imageUrl) {
//             console.log(`Generated Image URL: ${imageUrl}`);
//         }
//     })
//     .catch(error => console.error(error));


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
            messages: formattedMessages,
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



// Assuming all necessary imports and initialization as before

// A simple in-memory structure to hold conversation. For production, consider a more persistent solution.
let conversations = {};

// app.post('/', async (req, res) => {
//     const { userId, message } = req.body;

//     // Initialize conversation if not exists
//     if (!conversations[userId]) {
//         conversations[userId] = [];
//     }

//     try {
//         // Push the new user message into the conversation array
//         conversations[userId].push({ role: "user", content: message });

//         // Generate a response from OpenAI
//         const chatResponse = await openai.chat.completions.create({
//             model: "gpt-4-turbo-preview",
//             messages: conversations[userId],
//         });

//         let replyText = "";
//         let imageUrl = "";

//         if (chatResponse && chatResponse.data && chatResponse.data.choices && chatResponse.data.choices.length > 0) {
//             replyText = chatResponse.data.choices[0].message.content.trim();
//             // Save bot's reply into the conversation
//             conversations[userId].push({ role: "assistant", content: replyText });

//             // Concatenate all conversation texts to check the length
//             const conversationText = conversations[userId].map(m => m.content).join(" ");

//             // If conversation length exceeds a certain limit, summarize
//             if (conversationText.split(' ').length > 400) {
//                 const summary = await summarizeStory(conversationText);
//                 imageUrl = await generateImage(summary); // Generate an image based on the summary
//             } else {
//                 // Optionally, generate an image directly from the latest bot's response or skip
//                 // imageUrl = await generateImage(replyText);
//             }

//             console.log('Generated Image URL:', imageUrl);
//             res.json({ reply: replyText, imageUrl });
//         } else {
//             console.error("No reply from AI:", chatResponse);
//             res.status(500).json({ error: "Failed to generate a reply." });
//         }
//     } catch (error) {
//         console.error("Error handling chat request:", error);
//         res.status(500).json({ error: error.message });
//     }
// });
// app.post('/', async (req, res) => {
//     try {
//         const { userMessage, chatLog } = req.body;
//         console.log('Received user message:', userMessage);
//         console.log('Received chat log:', chatLog);

//         // Process the user's message to generate a response
//         const response = await callApi(userMessage, chatLog);
//         if (!response || response.startsWith('Invalid')) {
//             console.error("Failed to generate response:", response);
//             return res.status(400).json({ error: response });
//         }

//         // Summarize the generated response
//         const summary = await summarizeStory(response);
//         if (!summary) {
//             console.error("Failed to summarize the story.");
//             return res.status(500).json({ error: 'Failed to summarize the story.' });
//         }

//         // Generate an image based on the summary
//         const imageUrl = await generateImage(summary);
//         if (!imageUrl) {
//             console.error("Failed to generate an image.");
//             return res.status(500).json({ error: 'Failed to generate an image.' });
//         }

//         // Return the original response, summary, and image URL to the client
//         res.json({ message: response, summary, imageUrl });
//     } catch (error) {
//         console.error("Error handling request:", error);
//         res.status(500).json({ error: error.message });
//     }
// });
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
    const { prompt } = req.body;
    console.log('Received prompt for image generation:', prompt);

    try {
        const imageUrl = await generateImage(prompt); // Use the provided prompt for image generation
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

app.post('/generate-pdf', async (req, res) => {
    const { chatLog, imageUrl } = req.body;

    // Create a new PDF document
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment;filename=storybook.pdf',
        }).end(pdfData);
    });

    // Add text to the PDF from chatLog
    chatLog.forEach(entry => {
        if (entry.role === 'gpt') {
            doc.font('Times-Roman').fontSize(14).fillColor('blue');
        } else {
            doc.font('Times-Roman').fontSize(14).fillColor('black');
        }
        doc.text(entry.message, {
            paragraphGap: 5,
            indent: 20,
            align: 'justify',
            columns: 1,
        });
        doc.moveDown();
    });

    // Add the image to the PDF
    const response = await fetch(imageUrl);
    const imageBuffer = await response.buffer();
    doc.addPage().image(imageBuffer, {
        fit: [500, 500],
        align: 'center',
        valign: 'center'
    });

    // Finalize the PDF file
    doc.end();
});





app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
