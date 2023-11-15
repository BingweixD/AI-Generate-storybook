
// const { Configuration, OpenAIApi } = require("openai");
// const configuration = new Configuration({
//     organization: "org-rJK0lhu1nDdDGilWDk2eCXUA",
//     apiKey: "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",
// });

// const openai = new OpenAIApi(configuration);

// async function callApi(){
//     const response = await openai.createCompletion({
//     // const response = await openai.listEngines();
//     // curl https://api.openai.com/v1/completions \
//     //   -H "Content-Type: application/json" \
//     //   -H "Authorization: Bearer $OPENAI_API_KEY" \
//     //   -d '{
//         model: "text-davinci-003",
//         prompt: "Say this is a test",
//         max_tokens: 7,
//         temperature: 0
//     });
//         console.log(response,data.choice[0].text)
// }

// callApi()
//2nd code
// const express = require('express');
// const OpenAI = require("openai");
// const bodyParser = require ('body-parser')
// const cors = require ('cors')


// const openai = new OpenAI({
//   apiKey: "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"
// });

// const app = express();
// app.use(bodyParser.json())
// app.use(cors())
// const PORT = 3080;

// const callApi = async (userMessage) => {
//     try {
//         const systemMessage = { role: 'system', content: 'You are a helpful assistant.' };
//         const assistantMessage = { role: 'assistant', content: 'How can I help you today?' };
//         const user = { role: 'user', content: userMessage };
//         const chatCompletion = await openai.chat.completions.create({
//             model: "gpt-3.5-turbo",
//             messages: [systemMessage, assistantMessage, user],
//             max_tokens: 100
//         });
//         console.log("OpenAI API Response:", chatCompletion); // Log the entire response
//         if (
//             chatCompletion.data &&
//             chatCompletion.data.choices &&
//             chatCompletion.data.choices.length > 0 &&
//             chatCompletion.data.choices[0].message &&
//             chatCompletion.data.choices[0].message[0] &&
//             chatCompletion.data.choices[0].message[0].content
//         ) {
//             const content = chatCompletion.data.choices[0].message[0].content;
//             console.log('Content:', content);
//             return content;
//         } else {
//             console.error("Invalid response format from OpenAI API:", chatCompletion);
//             return 'An error occurred while fetching data.';
//         }
//     } catch (error) {
//         console.error("An error occurred while fetching data:", error);
//         return 'An error occurred while fetching data.';
//     }
// };

// app.post('/', async (req, res) => {
//     try {
//         const { userMessage } = req.body;
//         console.log('Received user message:', userMessage);
//         const response = await callApi(userMessage);
//         console.log('Final response to client:', response);
//         res.json({ message: response });
//     } catch (error) {
//         console.error("Error handling form submission:", error);
//         res.status(500).json({ error: error.message });
//     }
// });


// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });


// LOOOLL
const express = require('express');
const OpenAI = require("openai");
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: ""
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = 3080;

// Function to call OpenAI API
const callApi = async (userMessage) => {
    try {
        const systemMessage = { role: 'system', content: 'You are a helpful assistant.' };
        const assistantMessage = { role: 'assistant', content: 'How can I help you today?' };
        const user = { role: 'user', content: userMessage };

        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [systemMessage, assistantMessage, user],
            max_tokens: 1024
        });

        console.log("OpenAI API Response:", JSON.stringify(chatCompletion, null, 2));

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
        console.error("An error occurred while calling OpenAI API:", error);
        return 'An error occurred while fetching data.';
    }
};



// Endpoint to handle chat messages
app.post('/', async (req, res) => {
    try {
        const { userMessage } = req.body;
        console.log('Received user message:', userMessage);
        const response = await callApi(userMessage);
        console.log('Final response to client:', response);
        res.json({ message: response });
    } catch (error) {
        console.error("Error handling form submission:", error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
