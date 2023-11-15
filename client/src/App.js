// import logo from './logo.svg';
import './App.css';
import './normal.css';
import {useState} from 'react';

function App() {

  //add state fir input and chat log
  const [input, setInput] = useState("");
  const [chatLog, setChatlog] = useState([{
    role:"gpt",
    message: "How can i help you today?"
},{
    role:"me",
    message:"I want to use ChatGPT today"
}]);

  async function handleSubmit(e){
    e.preventDefault();
    const userMessage = input;
    setChatlog((prevChatLog) => [
      ...prevChatLog,
      { role: 'me', content: userMessage }, // Updated role to 'me'
    ]);
    setInput ("");
    //  // Create an array of messages for the API request
    //  const messagesArray = chatLog.map((message) => ({
    //   role: message.role,
    //   content: message.message,
    //   }));

      // Add the user's message to the array
      // messagesArray.push({ role: "user", content: userMessage });
    try{
      const response = await fetch ("http://localhost:3080/",{
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // message: chatLog.map((message)=>message.message).join("")
        userMessage: userMessage,
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response from server:', data);
    setChatlog((prevChatLog) => [
      ...prevChatLog,
      { role: "gpt", message: data.message},
    ]);
  } catch (error) {
    console.error("Error handling form submission:", error);
  }
  }
  
  return (
    <div className="App">
      <aside className ="sidemenu">
        <div className = "sidemenu-button">
          <span>+</span>
          New Chat
        </div>
      </aside>

      <section className="chatbox">
        <div className='chat-log'>
          {chatLog.map ((message, index)=>(<ChatMessage key={index} message ={message} />))}
        </div>
        <div className ="chat-input-holder">
          <form onSubmit = {handleSubmit}>
            <input 
              rows="1"
              value={input}
              onChange={(e)=> setInput(e.target.value)}
              className ="chat-input-textarea" 
              placeholder='Type your message here'>
            </input>
          </form>
          
        </div>


      </section>

     
    </div>
  );
}
const ChatMessage = ({message}) => {
  return(
    <div className={`chat-message ${message.role === "gpt" && "chatgpt"}`}>
            <div className='chat-message-center'>
              <div className={`avatar ${message.role === "gpt" && "chatgpt"}`}>
                {message.user === "gpt"} 
                {/* && <svg */}
              </div>
              <div className="message">{message.message || message.content}</div>
            </div>
          </div>
  )
}
export default App;
