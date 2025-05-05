import pickle
import os
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI

def load_qa_chain():
    try:
        with open("qa_chain.pkl", "rb") as f:
            return pickle.load(f)
    except FileNotFoundError:
        print("Error: QA chain not found. Please run build_rag.py first.")
        exit(1)

def main():
    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable not set.")
        print("Please set your OpenAI API key using:")
        print("export OPENAI_API_KEY='your-api-key'")
        exit(1)
    
    qa_chain = load_qa_chain()
    
    print("RAG System Ready!")
    print("Type 'exit' to quit")
    print("-" * 50)
    
    while True:
        query = input("\nEnter your question: ").strip()
        if query.lower() == 'exit':
            break
            
        try:
            result = qa_chain({"query": query})
            print("\nAnswer:")
            print(result["result"])
            print("-" * 50)
        except Exception as e:
            print(f"Error processing query: {str(e)}")

if __name__ == "__main__":
    main() 