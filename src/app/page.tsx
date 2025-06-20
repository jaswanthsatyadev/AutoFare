
"use client";

import React, { useState, useRef, useEffect, useCallback, useActionState } from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { processVerification, type VerificationResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Camera, Video, Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles, UploadCloud, CameraOff } from "lucide-react";

const SELFIE_PLACEHOLDER_URL = "https://placehold.co/400x400.png";

const initialState: VerificationResult = {
  status: "error", 
  message: "",
};

function ActualSubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={disabled || pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Verifying...
        </>
      ) : (
        "Verify Identity"
      )}
    </Button>
  );
}

export default function HomePage() {
  const [state, formAction] = useActionState(processVerification, initialState);
  const { toast } = useToast();

  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cctvVideoRef = useRef<HTMLVideoElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (state?.status === "error" && state.message) {
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: state.message,
      });
    } else if (state?.status === "verified" && state.message) {
       toast({
        title: "Verification Success",
        description: state.message,
      });
    } else if (state?.status === "failed" && state.message) {
       toast({
        variant: "destructive",
        title: "Verification Failed",
        description: state.message,
      });
    }
  }, [state, toast]);

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia not supported');
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Error',
          description: 'Your browser does not support camera access.',
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (cctvVideoRef.current) {
          cctvVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings and refresh the page.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (cctvVideoRef.current && cctvVideoRef.current.srcObject) {
        const stream = cctvVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const handleSelfieChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfiePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelfiePreview(null);
    }
  };

  const handleFormSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    const currentForm = event.currentTarget;
    const cctvHiddenInput = currentForm.elements.namedItem('cctvDataUri') as HTMLInputElement | null;

    if (hasCameraPermission && cctvVideoRef.current && cctvHiddenInput) {
      const videoElement = cctvVideoRef.current;

      if (videoElement.readyState < videoElement.HAVE_ENOUGH_DATA || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          toast({ variant: "destructive", title: "Camera Error", description: "Camera feed is not ready or has invalid dimensions. Please wait a moment." });
          event.preventDefault(); 
          return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
          toast({ variant: "destructive", title: "CaptureError", description: "Could not process video frame." });
          event.preventDefault();
          return;
      }
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      try {
        const dataUri = canvas.toDataURL('image/webp'); 
        cctvHiddenInput.value = dataUri;
      } catch (e) {
        console.error("Error converting canvas to Data URI:", e);
        toast({ variant: "destructive", title: "Capture Error", description: "Failed to capture video frame." });
        event.preventDefault();
        return;
      }
      
    } else if (!hasCameraPermission && cctvHiddenInput) {
      toast({ variant: "destructive", title: "Camera Required", description: "Camera access is required for CCTV footage." });
      event.preventDefault();
      return;
    }
    // Form submission will proceed with formAction
  }, [hasCameraPermission, toast]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background font-body">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-primary font-headline">VeriFace Transit</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Streamlined Identity Verification for Secure Access
        </p>
      </header>

      <main className="w-full max-w-4xl">
        <form ref={formRef} action={formAction} onSubmit={handleFormSubmit}>
          <input type="hidden" name="cctvDataUri" id="cctvDataUri" />
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline">Verification Portal</CardTitle>
              <CardDescription>
                Upload your selfie to verify your identity against live camera footage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Selfie Upload Section */}
                <div className="space-y-4">
                  <Label htmlFor="selfie" className="text-lg font-medium flex items-center gap-2">
                    <Camera className="w-6 h-6 text-primary" /> Your Selfie
                  </Label>
                  <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed">
                    {selfiePreview ? (
                      <Image
                        src={selfiePreview}
                        alt="Selfie preview"
                        width={400}
                        height={400}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground p-4">
                        <UploadCloud className="w-16 h-16 mx-auto mb-2" />
                        <p>Click to upload or drag & drop</p>
                        <p className="text-xs">PNG, JPG, WEBP up to 5MB</p>
                      </div>
                    )}
                  </div>
                  <Input
                    id="selfie"
                    name="selfie"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    ref={selfieInputRef}
                    onChange={handleSelfieChange}
                    required
                    className="file:text-primary file:font-semibold file:bg-primary/10 file:border-none file:rounded-md file:px-3 file:py-1.5 hover:file:bg-primary/20 cursor-pointer"
                  />
                </div>

                {/* CCTV Image Section */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium flex items-center gap-2">
                    <Video className="w-6 h-6 text-primary" /> Live CCTV Feed
                  </Label>
                  <div className="relative aspect-square w-full bg-muted rounded-lg overflow-hidden border-2">
                    <video ref={cctvVideoRef} className="object-cover w-full h-full" autoPlay muted playsInline />
                    {hasCameraPermission === null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="mt-2 text-muted-foreground">Initializing camera...</p>
                      </div>
                    )}
                  </div>
                  {hasCameraPermission === false && (
                    <Alert variant="destructive" className="mt-2">
                      <CameraOff className="h-4 w-4" />
                      <AlertTitle>Camera Access Denied</AlertTitle>
                      <AlertDescription>
                        VeriFace Transit needs camera access for CCTV footage. Please enable camera permissions in your browser settings and refresh the page.
                      </AlertDescription>
                    </Alert>
                  )}
                   <p className="text-sm text-muted-foreground">
                    Live camera feed for verification. A snapshot will be taken upon submission.
                  </p>
                </div>
              </div>

              {/* Verification Result Section */}
              {state?.status && state.status !== 'error' && (state.message || (state.status === 'failed' && state.summary)) && (
                <div className="mt-8 space-y-6">
                  <Alert variant={state.status === "verified" ? "default" : "destructive"} className={state.status === "verified" ? "border-green-500 bg-green-50 dark:bg-green-900/30" : "border-red-500 bg-red-50 dark:bg-red-900/30"}>
                    {state.status === "verified" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : state.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                    <AlertTitle className={state.status === "verified" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                      {state.status === "verified"
                        ? "Verification Successful"
                        : "Verification Failed"}
                    </AlertTitle>
                    <AlertDescription className={state.status === "verified" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {state.message}
                      {state.status === "failed" && state.summary && (
                        <p className="mt-2 font-medium">AI Summary: <span className="font-normal">{state.summary}</span></p>
                      )}
                    </AlertDescription>
                  </Alert>

                  {state.status === "failed" && state.enhancedImageUri && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-accent" />
                          AI Enhanced CCTV Image
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="aspect-square w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden border">
                          <Image
                            src={state.enhancedImageUri}
                            alt="Enhanced CCTV snapshot"
                            width={400}
                            height={400}
                            className="object-cover w-full h-full"
                            data-ai-hint="enhanced security"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <ActualSubmitButton disabled={!selfiePreview || hasCameraPermission !== true} />
            </CardFooter>
          </Card>
        </form>
      </main>
      <footer className="text-center mt-10 py-4 text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} VeriFace Transit. All rights reserved.
      </footer>
    </div>
  );
}
