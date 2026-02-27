
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Sparkles, Loader2, Send } from 'lucide-react';

const AIInsightsSection: React.FC = () => {
  const [query, setQuery] = useState('');
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setInsight(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a senior healthcare operations analyst. Based on this request: "${query}", provide a professional insight that a Hospital Administrator would find valuable. Format it as a concise insight followed by 3 actionable bullet points. Mention metrics like bed turnover, patient satisfaction, or operational cost.`,
        config: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      });

      setInsight(response.text || "Unable to generate insight at this time.");
    } catch (err) {
      console.error("Gemini Error:", err);
      setInsight("Error: Failed to connect to MedFlow AI Core. Please ensure you are authorized.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-24 bg-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-blue-100/50 rounded-full blur-[100px] -z-10"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/90 rounded-[2.5rem] p-5 md:p-8 shadow-2xl relative border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500 rounded-2xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Interactive AI Insights Demo</h2>
              <p className="text-slate-500 text-sm">Experience the power of MedFlow analytics engine.</p>
            </div>
          </div>

          <form onSubmit={generateInsight} className="relative mb-10">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., How can we reduce ER wait times by 15%?"
              className="w-full bg-slate-800 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-3 top-2.5 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </form>

          {insight && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-blue-400 font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> CLINICOS AI CORE INSIGHT
              </h3>
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-200 whitespace-pre-line text-lg leading-relaxed">
                  {insight}
                </p>
              </div>
            </div>
          )}

          {!insight && !loading && (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl">
              <p className="text-slate-500 italic">Enter an operational query above to see AI in action.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AIInsightsSection;
