import streamlit as st
import requests

st.title("🧠 Mental Health AI Support")
st.write("Type your thoughts below and get AI-powered support.")

user_input = st.text_area("How are you feeling today?")

if st.button("Get Support"):
    if user_input.strip():
        with st.spinner("Analyzing..."):
            response = requests.post("http://127.0.0.1:5000/analyze", json={"message": user_input})
            
            if response.status_code == 200:
                data = response.json()
                
                st.subheader("AI Response")
                st.write(data["ai_response"])
                
                st.subheader("Distress Level")
                st.write(f"**{data['distress_level']}**")
                
                st.subheader("Reasoning")
                st.write(data["reasoning"])  # Show AI's reasoning
                
                st.subheader("Recommendation")
                st.write(data["recommendation"])
            else:
                st.error("Error connecting to AI. Please try again.")
    else:
        st.warning("Please enter a message.")
