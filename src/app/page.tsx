
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
import { Camera, Video, Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles, UploadCloud, CameraOff, RefreshCw } from "lucide-react";

const SELFIE_PLACEHOLDER_URL = "https://placehold.co/400x400.png";

const initialVerificationResultState: VerificationResult = {
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
  const [verificationState, formAction] = useActionState(processVerification, initialVerificationResultState);
  const { toast } = useToast();

  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cctvVideoRef = useRef<HTMLVideoElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const programmaticSelfieDataUriRef = useRef<HTMLInputElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isPollingSelfie, setIsPollingSelfie] = useState(true);
  const [lastProcessedRemoteSelfieUri, setLastProcessedRemoteSelfieUri] = useState<string | null>(null);

  // Effect for toast notifications based on verificationState
  useEffect(() => {
    if (!verificationState) return;

    if (verificationState.status === "error" && verificationState.message) {
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: verificationState.message,
      });
    } else if (verificationState.status === "verified" && verificationState.message) {
       toast({
        title: "Verification Success",
        description: verificationState.message,
      });
    } else if (verificationState.status === "failed" && verificationState.message) {
       toast({
        variant: "destructive",
        title: "Verification Failed",
        description: verificationState.message,
      });
    }
    // If verification was triggered by a remote selfie, ensure its preview remains
    if (verificationState.selfieUsed && verificationState.selfieUsed === lastProcessedRemoteSelfieUri) {
        setSelfiePreview(verificationState.selfieUsed);
    }

  }, [verificationState, toast, lastProcessedRemoteSelfieUri]);

  // Effect for camera permission
  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Camera Error', description: 'Your browser does not support camera access.' });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (cctvVideoRef.current) cctvVideoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions and refresh.' });
      }
    };
    getCameraPermission();
    return () => {
      if (cctvVideoRef.current && cctvVideoRef.current.srcObject) {
        (cctvVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  // Effect for polling for remote selfies
  useEffect(() => {
    if (!isPollingSelfie) return;

    const POLLING_INTERVAL = 5000; // Poll every 5 seconds
    let intervalId: NodeJS.Timeout;

    const fetchLatestSelfie = async () => {
      try {
        const response = await fetch('/api/get-latest-selfie');
        if (!response.ok) {
          console.error("Failed to fetch latest selfie, status:", response.status);
          return;
        }
        const data = await response.json();
        if (data.selfieDataUri && data.selfieDataUri !== lastProcessedRemoteSelfieUri) {
          console.log("New remote selfie received:", data.selfieDataUri.substring(0,50) + "...");
          setSelfiePreview(data.selfieDataUri);
          setLastProcessedRemoteSelfieUri(data.selfieDataUri); // Mark as processed
          if (selfieInputRef.current) selfieInputRef.current.value = ""; // Clear file input

          // Set the hidden input for programmatic selfie
          if (programmaticSelfieDataUriRef.current) {
            programmaticSelfieDataUriRef.current.value = data.selfieDataUri;
          }
          
          const AUTO_SUBMIT_DELAY = 2000; // 2 seconds
          toast({
            title: "New Selfie Received",
            description: `Automatic verification will begin in ${AUTO_SUBMIT_DELAY / 1000} seconds.`,
          });

          setTimeout(() => {
            if (formRef.current) {
              const cctvHiddenInput = formRef.current.elements.namedItem('cctvDataUri') as HTMLInputElement | null;
              const videoElement = cctvVideoRef.current;
          
              // Check the video element directly. If permission was granted, it will have a srcObject.
              // Also check its readyState to make sure the stream is active.
              if (videoElement && videoElement.srcObject && cctvHiddenInput) {
                if (videoElement.readyState >= videoElement.HAVE_ENOUGH_DATA && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                  const canvas = document.createElement('canvas');
                  canvas.width = videoElement.videoWidth;
                  canvas.height = videoElement.videoHeight;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    try {
                      cctvHiddenInput.value = canvas.toDataURL('image/webp');
                      if (formRef.current) {
                        const formData = new FormData(formRef.current);
                        if (data.selfieDataUri) formData.delete('selfie');
                        formAction(formData);
                      }
                    } catch (e) {
                      toast({ variant: "destructive", title: "Capture Error", description: "Failed to capture video frame for programmatic submission." });
                    }
                  } else {
                    toast({ variant: "destructive", title: "Capture Error", description: "Could not get canvas context for programmatic submission." });
                  }
                } else {
                  // If srcObject exists but stream isn't ready, show a different error.
                  toast({ variant: "destructive", title: "Camera Error", description: "Camera feed not ready for programmatic submission." });
                }
              } else {
                // If srcObject doesn't exist, permission was likely denied or is pending.
                toast({ variant: "destructive", title: "Camera Required", description: "Camera access needed for programmatic submission." });
              }
            }
          }, AUTO_SUBMIT_DELAY);
        }
      } catch (error) {
        console.error("Error polling for latest selfie:", error);
      }
    };

    fetchLatestSelfie(); // Initial fetch
    intervalId = setInterval(fetchLatestSelfie, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPollingSelfie, lastProcessedRemoteSelfieUri, toast, formAction]);


  const handleSelfieChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfiePreview(reader.result as string);
        // If user uploads manually, stop using remote selfie and clear its trace
        setLastProcessedRemoteSelfieUri(null); 
        if (programmaticSelfieDataUriRef.current) programmaticSelfieDataUriRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } else {
      setSelfiePreview(null);
    }
  };
  
  const handleFormSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    const currentForm = event.currentTarget;
    const cctvHiddenInput = currentForm.elements.namedItem('cctvDataUri') as HTMLInputElement | null;

    // This check is primarily for manual submissions. Programmatic submissions handle this within the useEffect.
    if (event.nativeEvent instanceof SubmitEvent) { // Check if it's a manual submit
        if (hasCameraPermission && cctvVideoRef.current && cctvHiddenInput) {
            const videoElement = cctvVideoRef.current;
            if (videoElement.readyState < videoElement.HAVE_ENOUGH_DATA || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                toast({ variant: "destructive", title: "Camera Error", description: "Camera feed is not ready. Please wait." });
                event.preventDefault(); 
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                toast({ variant: "destructive", title: "Capture Error", description: "Could not process video frame." });
                event.preventDefault(); return;
            }
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            try {
                cctvHiddenInput.value = canvas.toDataURL('image/webp'); 
            } catch (e) {
                toast({ variant: "destructive", title: "Capture Error", description: "Failed to capture video frame." });
                event.preventDefault(); return;
            }
        } else if (!hasCameraPermission && cctvHiddenInput) {
            toast({ variant: "destructive", title: "Camera Required", description: "Camera access is required." });
            event.preventDefault(); return;
        }
    }
    // Let formAction proceed
  }, [hasCameraPermission, toast]);

  const togglePolling = () => setIsPollingSelfie(prev => !prev);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background font-body">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-primary font-headline">VeriFace Transit</h1>
        <p className="text-lg text-muted-foreground mt-2">Streamlined Identity Verification</p>
      </header>

      <main className="w-full max-w-4xl">
        <div className="flex justify-end mb-2">
            <Button onClick={togglePolling} variant="outline" size="sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${isPollingSelfie ? "animate-spin" : ""}`} />
                {isPollingSelfie ? "Stop Polling Remote Selfies" : "Start Polling Remote Selfies"}
            </Button>
        </div>
        <form ref={formRef} action={formAction} onSubmit={handleFormSubmit}>
          <input type="hidden" name="cctvDataUri" id="cctvDataUri" />
          <input type="hidden" name="programmaticSelfieDataUri" ref={programmaticSelfieDataUriRef} />
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline">Verification Portal</CardTitle>
              <CardDescription>Upload your selfie or allow remote photo for verification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <Label htmlFor="selfie" className="text-lg font-medium flex items-center gap-2">
                    <Camera className="w-6 h-6 text-primary" /> Your Selfie
                  </Label>
                  <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed">
                    {selfiePreview ? (
                      <Image src={selfiePreview} alt="Selfie preview" width={400} height={400} className="object-cover w-full h-full" />
                    ) : (
                      <div className="text-center text-muted-foreground p-4">
                        <UploadCloud className="w-16 h-16 mx-auto mb-2" />
                        <p>Click to upload or await remote photo</p>
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
                    className="file:text-primary file:font-semibold file:bg-primary/10 file:border-none file:rounded-md file:px-3 file:py-1.5 hover:file:bg-primary/20 cursor-pointer"
                  />
                </div>

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
                      <AlertDescription>Enable camera permissions and refresh.</AlertDescription>
                    </Alert>
                  )}
                   <p className="text-sm text-muted-foreground">A snapshot will be taken upon submission.</p>
                </div>
              </div>

              {verificationState?.status && (verificationState.status !== 'error' || verificationState.message) && (verificationState.message || (verificationState.status === 'failed' && verificationState.summary)) && (
                <div className="mt-8 space-y-6">
                  <Alert variant={verificationState.status === "verified" ? "default" : "destructive"} className={verificationState.status === "verified" ? "border-green-500 bg-green-50 dark:bg-green-900/30" : "border-red-500 bg-red-50 dark:bg-red-900/30"}>
                    {verificationState.status === "verified" ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /> : 
                     verificationState.status === "failed" ? <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> : 
                     <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
                    <AlertTitle className={verificationState.status === "verified" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                      {verificationState.status === "verified" ? "Verification Successful" : 
                       verificationState.status === "failed" ? "Verification Failed" : "Verification Info"}
                    </AlertTitle>
                    <AlertDescription className={verificationState.status === "verified" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {verificationState.message}
                      {verificationState.status === "failed" && verificationState.summary && (
                        <p className="mt-2 font-medium">AI Summary: <span className="font-normal">{verificationState.summary}</span></p>
                      )}
                    </AlertDescription>
                  </Alert>

                  {verificationState.status === "failed" && verificationState.enhancedImageUri && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" />AI Enhanced CCTV Image</CardTitle></CardHeader>
                      <CardContent>
                        <div className="aspect-square w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden border">
                          <Image src={verificationState.enhancedImageUri} alt="Enhanced CCTV" width={400} height={400} className="object-cover w-full h-full" data-ai-hint="enhanced security" />
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
