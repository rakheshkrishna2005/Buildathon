import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Search, FileText, Loader2, AlertCircle } from 'lucide-react';

const LandingPage = () => {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length || !query) {
      alert("Please upload resumes and enter a query");
      return;
    }

    const formData = new FormData();
    files.forEach((file, idx) => formData.append(`files`, file));
    formData.append("query", query);

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5000/upload_and_query", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setResponse(res.data.response || "No response received.");
    } catch (err) {
      setResponse("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      {/*
      <div className="bg-white/80 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Resume Query Assistant
            </h1>
          </div>
        </div>
      </div>*/}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Find the Perfect Candidate
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload resumes and query them with natural language to find candidates with specific skills and experience.
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h3 className="text-xl font-semibold text-white">Upload & Query Resumes</h3>
            <p className="text-blue-100 mt-1">Select your resume folder and ask any question</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* File Upload Section */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Upload className="w-5 h-5 text-blue-600" />
                Upload Resume Folder
              </label>
              <div className="relative">
                <input
                  type="file"
                  webkitdirectory="true"
                  directory=""
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors bg-blue-50/50">
                  <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700">
                    Click to select resume folder
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose a folder containing multiple resume files
                  </p>
                  {files.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-700 font-medium">
                        {files.length} files selected
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Query Section */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Search className="w-5 h-5 text-purple-600" />
                Enter Your Query
              </label>
              <div className="relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., Who has experience with Flask and MongoDB? Find candidates with Python and machine learning skills."
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all resize-none text-gray-700 placeholder-gray-400"
                  rows="4"
                />
                <div className="absolute bottom-3 right-3">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !files.length || !query.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Resumes...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Analyze Resumes
                </>
              )}
            </button>
          </form>
        </div>

        {/* Response Section */}
        {response && (
          <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Analysis Results
              </h3>
            </div>
            <div className="p-8">
              {response.startsWith("Error:") ? (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-800 mb-1">Error Occurred</h4>
                    <pre className="whitespace-pre-wrap text-red-700 font-mono text-sm">
                      {response}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200 font-mono text-sm">
                    {response}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Bulk Upload</h3>
            <p className="text-gray-600 text-sm">Upload entire folders of resumes at once for efficient processing</p>
          </div>
          
          <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Natural Language</h3>
            <p className="text-gray-600 text-sm">Ask questions in plain English to find the right candidates</p>
          </div>
          
          <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Smart Analysis</h3>
            <p className="text-gray-600 text-sm">AI-powered resume analysis for accurate candidate matching</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
