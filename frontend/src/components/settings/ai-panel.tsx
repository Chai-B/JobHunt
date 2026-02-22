"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Info } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export function AIPanel({ formData, handleChange }: { formData: any, handleChange: any }) {
    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
            <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4" /> AI Integrations
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Provide your API keys. Comma separation enables automatic round-robin key rotation.</p>
            </div>
            <div className="col-span-3 grid gap-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                        <Label htmlFor="llm_provider" className={labelClass}>LLM Provider</Label>
                        <select id="llm_provider" name="llm_provider" value={formData.llm_provider} onChange={handleChange} className={`${inputClass} px-3 appearance-none cursor-pointer max-w-xs`}>
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI Compatible (OpenRouter/Groq/etc)</option>
                        </select>
                    </div>

                    {formData.llm_provider === "gemini" ? (
                        <>
                            <div>
                                <Label htmlFor="gemini_api_keys" className={labelClass}>Gemini API Keys <Tip text="Provide multiple keys separated by commas for rotation." /></Label>
                                <Input id="gemini_api_keys" name="gemini_api_keys" value={formData.gemini_api_keys} onChange={handleChange} type="password" placeholder="AIzaSyA..., AIzaSyB..." className={`${inputClass} font-mono`} />
                            </div>
                            <div>
                                <Label htmlFor="preferred_model" className={labelClass}>Preferred AI Model</Label>
                                <select id="preferred_model" name="preferred_model" value={formData.preferred_model} onChange={handleChange} className={`${inputClass} px-3 appearance-none cursor-pointer`}>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                    <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <Label htmlFor="openai_api_key" className={labelClass}>Custom API Key</Label>
                                <Input id="openai_api_key" name="openai_api_key" value={formData.openai_api_key} onChange={handleChange} type="password" placeholder="sk-..." className={`${inputClass} font-mono`} />
                            </div>
                            <div>
                                <Label htmlFor="llm_base_url" className={labelClass}>Base URL</Label>
                                <Input id="llm_base_url" name="llm_base_url" value={formData.llm_base_url} onChange={handleChange} placeholder="https://api.openai.com/v1" className={`${inputClass} font-mono`} />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="preferred_model" className={labelClass}>Model Name</Label>
                                <Input id="preferred_model" name="preferred_model" value={formData.preferred_model} onChange={handleChange} placeholder="gpt-4o" className={inputClass} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
