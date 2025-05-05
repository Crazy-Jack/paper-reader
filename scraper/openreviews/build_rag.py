import os
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.chains import RetrievalQA
from langchain_openai import ChatOpenAI
import pickle
import time

def process_pdf(pdf_path):
    try:
        loader = PyPDFLoader(pdf_path)
        return loader.load()
    except Exception as e:
        print(f"Error processing {pdf_path}: {str(e)}")
        return []

# Initialize the embedding model
print("Initializing OpenAI embedding model...")
embeddings = OpenAIEmbeddings()

# Directory containing PDFs
pdf_dir = "pdfs"

# Load and process all PDFs
print("\nProcessing PDFs...")
documents = []
for pdf_file in os.listdir(pdf_dir):
    if pdf_file.endswith('.pdf'):
        print(f"Processing {pdf_file}...")
        pdf_path = os.path.join(pdf_dir, pdf_file)
        docs = process_pdf(pdf_path)
        if docs:
            documents.extend(docs)
            print(f"✓ Successfully processed {pdf_file}")
        else:
            print(f"✗ Failed to process {pdf_file}")

if not documents:
    print("No documents were successfully processed. Exiting.")
    exit(1)

# Split documents into chunks
print("\nSplitting documents into chunks...")
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
texts = text_splitter.split_documents(documents)
print(f"Created {len(texts)} text chunks")

# Create vector store
print("\nCreating vector store...")
vectorstore = FAISS.from_documents(texts, embeddings)

# Save the vector store
print("Saving vector store...")
vectorstore.save_local("vector_store")
print("✓ Vector store saved to 'vector_store'")

# Create retrieval QA chain
print("\nInitializing OpenAI LLM...")
llm = ChatOpenAI(model_name="gpt-3.5-turbo")

print("Creating QA chain...")
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=vectorstore.as_retriever(search_kwargs={"k": 3})
)

# Save the QA chain
print("Saving QA chain...")
with open("qa_chain.pkl", "wb") as f:
    pickle.dump(qa_chain, f)
print("✓ QA chain saved to 'qa_chain.pkl'")

print("\nRAG system built successfully!")
print("You can now use the system to query the papers.") 