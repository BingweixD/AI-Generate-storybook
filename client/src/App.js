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

function createCoverImagePrompt(story) {
    // This is a placeholder function. You might want to implement a more sophisticated method
    // to generate a summary or extract key elements from the story for the cover image prompt.
    // For simplicity, we'll just take the first few sentences to hint at the theme.
    const endIndex = findSplitIndex(story, 150); // Attempt to get the first 150 characters and then go to the end of the sentence.
    return story.substring(0, endIndex) + "..."; // Return this as the prompt, indicating it's a snippet.
}

async function generateImage(story, styleHints, previousAttributes, referenceImages = []) {
    console.time("generateImage"); // Start timing

    const coverPrompt = createCoverImagePrompt(story);
    const splitIndex = findSplitIndex(story, Math.floor(story.length / 2));
    const parts = [
        story.substring(0, splitIndex),
        story.substring(splitIndex),
    ];
    const prompts = [coverPrompt, ...parts];

    const imagePromises = prompts.map((prompt, index) => {
        if (index === 0) {
            prompt = `Generate a cover image for a story with the following theme: "${prompt}"`;
        } else {
            prompt = `${prompt.trim()}.`;
        }

        if (styleHints) prompt += ` Style hints: ${styleHints}.`;
        if (previousAttributes) prompt += ` Include ${previousAttributes}, maintaining the color palette and character design of previous images.`;
        if (referenceImages && referenceImages.length > 0) prompt += ` Reference images are provided to maintain consistency.`;

        return axios.post('https://api.openai.com/v1/images/generations', {
            model: "dall-e-3",
            prompt,
            n: 1,
            size: "1024x1024",
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DALLE_API_KEY}`
            }
        })
        .then(response => {
            if (response.data && response.data.data && response.data.data.length > 0) {
                return response.data.data[0].url;
            } else {
                console.log("API response did not contain any images. Response:", response.data);
                return '';
            }
        })
        .catch(error => {
            console.error("An error occurred while generating the image:", error);
            return '';
        });
    });

    try {
        const start = performance.now(); // Start performance timer
        const imageUrls = await Promise.all(imagePromises);
        const end = performance.now(); // End performance timer
        console.log(`Image generation took ${end - start} milliseconds.`);

        console.timeEnd("generateImage"); // End timing
        return imageUrls;
    } catch (error) {
        console.error("An error occurred while generating images:", error);
        console.timeEnd("generateImage"); // End timing even if there's an error
        return [];
    }
}




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
        // Now, generateImage returns an array of image URLs
        const imageUrls = await generateImage(prompt, styleHints, previousAttributes);
        if (!imageUrls || imageUrls.length === 0) {
            console.error("Failed to generate images.");
            return res.status(400).json({ error: 'Failed to generate images.' });
        }

        res.json({ imageUrls }); // Send back an array of URLs
    } catch (error) {
        console.error("Error handling image generation request:", error);
        res.status(500).json({ error: error.message });
    }
});
function findSplitIndex(story, startApproxIndex) {
    // Find the nearest full stop after the approximate split index
    let index = story.indexOf('.', startApproxIndex);
    return index !== -1 ? index + 1 : startApproxIndex; // Return the index right after the full stop or the original index if not found
}
function getNextImageUrl(chatLog, usedImageUrls) {
    for (let entry of chatLog) {
        if (entry.message.startsWith('Image URL: ') && !usedImageUrls.has(entry.message)) {
            usedImageUrls.add(entry.message);
            return entry.message.replace('Image URL: ', '');
        }
    }
    return null; // Return null if there's no next image URL.
}
function extractFlexibleTitle(storyText) {
    // Normalize line endings
    storyText = storyText.replace(/\r\n/g, "\n");

    // Attempt to match a quoted title that appears immediately after a specific intro or standalone
    const introPattern = /(?:discussion:|Certainly! Here's the full story based on our discussion:)\s*"([^"]+)"/i;
    const standaloneQuotePattern = /^"([^"]+)"/;
    
    // Check for an explicit "Title:" marker or quoted title following an introduction
    let titleMatch = storyText.match(introPattern) || storyText.match(standaloneQuotePattern);
    if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
    }

    // Check for an explicit "Title:" marker without introduction
    titleMatch = storyText.match(/^Title:\s*(.+)/i);
    if (titleMatch) {
        return titleMatch[1].trim();
    }

    // Fallback to using the first significant text as the title if no pattern matches
    let firstSignificantText = storyText.split(/[\n\.]/, 1)[0];
    return firstSignificantText.trim();
}


app.post('/generate-pdf', async (req, res) => {
    const { chatLog } = req.body;

    // Assuming `chatLog` contains the full story text in a format you can use
    const storyContent = "StoryBook"; // Placeholder, replace with actual content
    const title = extractFlexibleTitle(storyContent);

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

    // Add the title to the PDF before adding the cover image
    doc.fontSize(24) // Adjust the size as needed
       .font('Helvetica-Bold') // You can choose any font you prefer
       .text(title, {
           align: 'center',
           underline: false, // Set to true if you want the title underlined
       })
       .moveDown(2); // Adjust space between the title and the image as needed

    // Extract the cover image URL
    let coverImageUrl = getNextImageUrl(chatLog, usedImageUrls);
    if (coverImageUrl) {
        try {
            const coverImageResponse = await fetch(coverImageUrl);
            if (coverImageResponse.ok) {
                const coverImageBuffer = await coverImageResponse.buffer();
                // Consider adjusting the positioning if needed
                doc.image(coverImageBuffer, {
                    fit: [500, 400], // You might want to adjust the size to fit the title
                    align: 'center',
                    valign: 'center'
                })
                .addPage(); // Ensure the story starts on a new page
            } else {
                console.error("Failed to load cover image for PDF:", coverImageResponse.statusText);
            }
        } catch (error) {
            console.error("Error fetching cover image for PDF:", error);
        }
    }

    const longestStory = chatLog.filter(entry => entry.role === 'gpt' && !entry.message.startsWith('Image URL: '))
                                 .reduce((longest, current) => current.message.length > longest.message.length ? current : longest, {message: ""}).message;

    // Calculate approximate split points
    const firstSplit = Math.floor(longestStory.length / 3);
    const secondSplit = Math.floor(2 * longestStory.length / 3);

    // Adjust split points to the nearest sentence end
    const firstSplitIndex = findSplitIndex(longestStory, firstSplit);
    const secondSplitIndex = findSplitIndex(longestStory, secondSplit);

    // Split the story
    const parts = [
        longestStory.substring(0, firstSplitIndex),
        longestStory.substring(firstSplitIndex, secondSplitIndex),
        longestStory.substring(secondSplitIndex)
    ];

    for (const part of parts) {
        doc.addPage();
        doc.font('Times-Roman').fontSize(14).fillColor('blue').text(part.trim(), {
            paragraphGap: 5,
            indent: 20,
            align: 'justify',
            columns: 1,
        });

        let imageUrl = getNextImageUrl(chatLog, usedImageUrls);
        if (imageUrl) {
            try {
                const imageResponse = await fetch(imageUrl);
                if (imageResponse.ok) {
                    const imageBuffer = await imageResponse.buffer();
                    // Adding image on the same page if possible, adjust as needed
                    doc.addPage(); // You might want to adjust this part to better handle image placement
                    doc.image(imageBuffer, { fit: [500, 500], align: 'center', valign: 'center' });
                } else {
                    console.error("Failed to load image for PDF:", imageResponse.statusText);
                }
            } catch (error) {
                console.error("Error fetching image for PDF:", error);
            }
        }
    }

    doc.end();
});

// app.get('/download-pdf/:pdfId', async (req, res) => {
//     const { pdfId } = req.params;

//     try {
//         const [rows] = await db.query('SELECT pdf FROM pdfs WHERE id = ?', [pdfId]);
//         if (rows.length > 0) {
//             const pdfBuffer = rows[0].pdf;
//             res.writeHead(200, {
//                 'Content-Type': 'application/pdf',
//                 'Content-Disposition': 'attachment; filename="story.pdf"'
//             }).end(pdfBuffer);
//         } else {
//             res.status(404).send('PDF not found');
//         }
//     } catch (error) {
//         console.error("Error fetching PDF from database:", error);
//         res.status(500).send('Failed to download PDF');
//     }
// });

// app.get('/stories', async (req, res) => {
//     try {
//         const [stories] = await db.query('SELECT id, title, created_at FROM stories');
//         res.json(stories);
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Internal Server Error');
//     }
// });


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});