"use client";

import React, { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (file: File) => void;
  isRecordingDisabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, isRecordingDisabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        onRecordingComplete(file);
        setIsProcessing(false);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("No se pudo acceder al micrófono.");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={isRecordingDisabled || isProcessing}
      onClick={isRecording ? stopRecording : startRecording}
      className={cn(
        "rounded-full transition-all duration-300",
        isRecording ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse" : "text-white/50 hover:text-white hover:bg-white/10"
      )}
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <Square className="w-5 h-5 fill-current" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </Button>
  );
}
