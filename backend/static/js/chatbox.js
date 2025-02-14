const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessage = document.querySelector("#send-message");
// const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = fileUploadWrapper.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const closeChatbot = document.querySelector("#close-chatbot");


const userData = {
  message: null,
  file: {
    data: null,
    mime_type: null,
  },
};

// Store chat history
const chatHistory = [];
const initialInputHeight = messageInput.scrollHeight;

// Create message element with dynamic classes and return it
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Generate bot response using API
// API setup

// Generate bot response using Flask API
const generateBotResponse = async (incomingMessageDiv) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");

  // Add user message to chat history
  chatHistory.push({
      role: "user",
      parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: userData.file }] : [])],
  });

  // API request options
  const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userData.message })
  };

  try {
      // Fetch bot response from Flask API
      const response = await fetch('/analyze', requestOptions);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Something went wrong.");

      // Extract and display bot's response text
      const { ai_response, distress_level, reasoning, recommendation, video_recommendations } = data;

      messageElement.innerHTML = 
          `<p class="bot-text">${ai_response}</p>
          <div class="bot-info">
              <p><strong>🆘 Distress Level:</strong> ${distress_level}</p>
              <p><strong>💡 Reason:</strong> ${reasoning}</p>
              <p><strong>✅ Recommendation:</strong> ${recommendation}</p>
          </div>`;

      // Add emergency button if distress level is high
      if (distress_level.toLowerCase() === "high" || distress_level >= 8) {
          const emergencyButton = document.createElement("button");
          emergencyButton.textContent = "🚨 Call 911";
          emergencyButton.style.backgroundColor = "#ff0000";
          emergencyButton.style.color = "white";
          emergencyButton.style.padding = "10px 20px";
          emergencyButton.style.border = "none";
          emergencyButton.style.borderRadius = "5px";
          emergencyButton.style.cursor = "pointer";
          emergencyButton.onclick = () => {
              window.location.href = "tel:911";
          };
          messageElement.appendChild(emergencyButton);

          // Check geolocation permission status
          if (navigator.permissions) {
              const permissionStatus = await navigator.permissions.query({ name: "geolocation" });

              if (permissionStatus.state === "granted") {
                  // Location permission already granted, fetch and show location
                  navigator.geolocation.getCurrentPosition(
                      async (position) => {
                          const { latitude, longitude } = position.coords;
                          // Fetch nearby doctors based on the user's location
                          await showNearbyLocations(latitude, longitude, messageElement);
                        },
                      (error) => {
                          messageElement.innerHTML += `<p class="error-message">Unable to access your location: ${error.message}</p>`;
                      }
                  );
              } else if (permissionStatus.state === "denied") {
                  messageElement.innerHTML += `<p class="error-message">Location permission denied.</p>`;
              } else {
                  // If permission is not yet requested, ask for it
                  if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                          async (position) => {
                              const { latitude, longitude } = position.coords;
                              // Fetch nearby doctors based on the user's location
                              await showNearbyLocations(latitude, longitude, messageElement);
                            },
                          (error) => {
                              messageElement.innerHTML += `<p class="error-message">Unable to access your location: ${error.message}</p>`;
                          }
                      );
                  } else {
                      messageElement.innerHTML += `<p class="error-message">Geolocation is not supported by this browser.</p>`;
                  }
              }
          }
      }

      // Add embedded video recommendations if available
      if (video_recommendations && Array.isArray(video_recommendations)) {
          video_recommendations.forEach(videoUrl => {
              if (videoUrl.includes('youtube.com')) {
                  const videoEmbed = 
                      `<div class="video-container">
                          <iframe 
                              src="https://www.youtube.com/embed/${getYouTubeVideoId(videoUrl)}" 
                              frameborder="0" 
                              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                              allowfullscreen>
                          </iframe>
                      </div>`;
                  messageElement.innerHTML += videoEmbed;
              }
          });
      }

      // Add bot response to chat history
      chatHistory.push({
          role: "model",
          parts: [{ text: ai_response }],
      });
  } catch (error) {
      console.log(error);
      messageElement.innerHTML = 
          `<div class="error-message">
              <span class="error-icon">⚠️</span> ${error.message}
          </div>`;
      messageElement.style.color = "#ff0000";
  } finally {
      // Reset user's file data, remove thinking indicator, and scroll chat to bottom
      userData.file = {};
      incomingMessageDiv.classList.remove("thinking");
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }
};

// Helper function to extract YouTube video ID from URL
const getYouTubeVideoId = (url) => {
  const regExp = /^https:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match && match[2] ? match[2] : '';
};

const showNearbyLocations = async (latitude, longitude, messageElement) => {
  // Remove any existing map inside this specific messageElement
  const existingMap = messageElement.querySelector(".leaflet-container");
  if (existingMap) {
    existingMap.remove();
  }

  const mapElement = document.createElement("div");
  mapElement.style.height = "400px";
  mapElement.style.width = "100%";
  messageElement.querySelector(".bot-info").appendChild(mapElement);

  // Create map
  const map = L.map(mapElement).setView([latitude, longitude], 13);

  // Set up OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // Add a marker for the user's location
  L.marker([latitude, longitude]).addTo(map).bindPopup("You are here").openPopup();

  // Generate random hospital locations (just for example)
  const hospitalLocations = generateRandomNearbyLocations(latitude, longitude, 3, "hospital");
  const doctorLocations = generateRandomNearbyLocations(latitude, longitude, 4, "doctor");

  // Create custom icons
  const hospitalIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.freepik.com/512/8145/8145721.png', // Update with the direct URL of the hospital icon
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });

  const doctorIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.freepik.com/512/8145/8145721.png', // Update with the direct URL of the doctor icon
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });

  // Add markers for hospitals and doctors with custom icons
  hospitalLocations.forEach(location => {
    L.marker([location.lat, location.lon], { icon: hospitalIcon })
      .addTo(map)
      .bindPopup("Hospital: " + location.name)
      .on('click', () => routeToLocation(latitude, longitude, location, map));
  });

  doctorLocations.forEach(location => {
    L.marker([location.lat, location.lon], { icon: doctorIcon })
      .addTo(map)
      .bindPopup("Doctor: " + location.name)
      .on('click', () => routeToLocation(latitude, longitude, location, map));
  });
};

// Function to generate random nearby locations
const generateRandomNearbyLocations = (lat, lon, count, type) => {
  const locations = [];
  for (let i = 0; i < count; i++) {
    const randomLat = lat + (Math.random() - 0.5) * 0.01;  // Adding a small random offset
    const randomLon = lon + (Math.random() - 0.5) * 0.01;
    locations.push({
      name: `${type} ${i + 1}`,
      lat: randomLat,
      lon: randomLon
    });
  }
  return locations;
};

// Function to route to a selected location (using Leaflet Routing Machine)
const routeToLocation = (startLat, startLon, destination, map) => {
  const endLat = destination.lat;
  const endLon = destination.lon;

  // Create a routing control (using Leaflet Routing Machine)
  const routeControl = L.Routing.control({
    waypoints: [
      L.latLng(startLat, startLon),  // User's current location
      L.latLng(endLat, endLon)       // Destination (hospital/doctor)
    ],
    routeWhileDragging: true, // Allow dragging of the route to see new directions
    createMarker: () => null  // Disable marker creation for each waypoint
  }).addTo(map);

  // Optionally, center the map on the route
  map.fitBounds(routeControl.getBounds());
};


// Handle outgoing user messages
const handleOutgoingMessage = (e) => {
  e.preventDefault();
  userData.message = messageInput.value.trim();
  messageInput.value = "";
  messageInput.dispatchEvent(new Event("input"));
  fileUploadWrapper.classList.remove("file-uploaded");

  // Create and display user message
  const messageContent = `<div class="message-text"></div>
                          ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment" />` : ""}`;

  const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
  outgoingMessageDiv.querySelector(".message-text").innerText = userData.message;
  chatBody.appendChild(outgoingMessageDiv);
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

  // Simulate bot response with thinking indicator after a delay
  setTimeout(() => {
    const messageContent = `<img class="bot-avatar" src="{{ url_for('static', filename='images/robotic.png') }}" alt="Chatbot Logo" width="50" height="50">
          </img>
          <div class="message-text">
            <div class="thinking-indicator">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>`;

    const incomingMessageDiv = createMessageElement(messageContent, "bot-message", "thinking");
    chatBody.appendChild(incomingMessageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    generateBotResponse(incomingMessageDiv);
  }, 600);
};

// Adjust input field height dynamically
messageInput.addEventListener("input", () => {
  messageInput.style.height = `${initialInputHeight}px`;
  messageInput.style.height = `${messageInput.scrollHeight}px`;
  document.querySelector(".chat-form").style.borderRadius = messageInput.scrollHeight > initialInputHeight ? "15px" : "32px";
});

// Handle Enter key press for sending messages
messageInput.addEventListener("keydown", (e) => {
  const userMessage = e.target.value.trim();
  if (e.key === "Enter" && !e.shiftKey && userMessage && window.innerWidth > 768) {
    handleOutgoingMessage(e);
  }
});

// Handle file input change and preview the selected file
// fileInput.addEventListener("change", () => {
//   const file = fileInput.files[0];
//   if (!file) return;

//   const reader = new FileReader();
//   reader.onload = (e) => {
//     fileInput.value = "";
//     fileUploadWrapper.querySelector("img").src = e.target.result;
//     fileUploadWrapper.classList.add("file-uploaded");
//     const base64String = e.target.result.split(",")[1];

//     // Store file data in userData
//     userData.file = {
//       data: base64String,
//       mime_type: file.type,
//     };
//   };

//   reader.readAsDataURL(file);
// });

// Cancel file upload
fileCancelButton.addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-uploaded");
});

// Initialize emoji picker and handle emoji selection
const picker = new EmojiMart.Picker({
  theme: "light",
  skinTonePosition: "none",
  previewPosition: "none",
  onEmojiSelect: (emoji) => {
    const { selectionStart: start, selectionEnd: end } = messageInput;
    messageInput.setRangeText(emoji.native, start, end, "end");
    messageInput.focus();
  },
  onClickOutside: (e) => {
    if (e.target.id === "emoji-picker") {
      document.body.classList.toggle("show-emoji-picker");
    } else {
      document.body.classList.remove("show-emoji-picker");
    }
  },
});

document.querySelector(".chat-form").appendChild(picker);

sendMessage.addEventListener("click", (e) => handleOutgoingMessage(e));
// document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());
closeChatbot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));