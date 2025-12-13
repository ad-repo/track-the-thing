#import <Foundation/Foundation.h>
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>

// Callback type for transcription results
typedef void (*TranscriptionCallback)(const char *text, bool isFinal);

// Global state
static SFSpeechRecognizer *speechRecognizer = nil;
static SFSpeechAudioBufferRecognitionRequest *recognitionRequest = nil;
static SFSpeechRecognitionTask *recognitionTask = nil;
static AVAudioEngine *audioEngine = nil;
static TranscriptionCallback transcriptionCallback = NULL;
static BOOL tapInstalled = NO;  // Track if audio tap is installed
static NSString *lastTranscription = nil;  // Store last transcription for final emit

// Helper function to safely remove audio tap
static void safelyRemoveTap(void) {
    if (!tapInstalled) {
        NSLog(@"[SpeechBridge] Tap not installed, skipping removal");
        return;
    }
    
    if (audioEngine == nil) {
        NSLog(@"[SpeechBridge] Audio engine is nil, skipping tap removal");
        tapInstalled = NO;
        return;
    }
    
    AVAudioInputNode *inputNode = audioEngine.inputNode;
    if (inputNode == nil) {
        NSLog(@"[SpeechBridge] Input node is nil, skipping tap removal");
        tapInstalled = NO;
        return;
    }
    
    @try {
        [inputNode removeTapOnBus:0];
        NSLog(@"[SpeechBridge] Audio tap removed successfully");
    } @catch (NSException *exception) {
        NSLog(@"[SpeechBridge] Exception removing tap (already removed?): %@", exception.reason);
    }
    
    tapInstalled = NO;
}

// Helper function to clean up all resources
static void cleanupRecognition(void) {
    NSLog(@"[SpeechBridge] Cleaning up recognition resources");
    
    // Stop audio engine first
    if (audioEngine != nil && audioEngine.isRunning) {
        [audioEngine stop];
        NSLog(@"[SpeechBridge] Audio engine stopped");
    }
    
    // End audio on recognition request
    if (recognitionRequest != nil) {
        [recognitionRequest endAudio];
        NSLog(@"[SpeechBridge] Recognition request endAudio called");
    }
    
    // Safely remove the audio tap
    safelyRemoveTap();
    
    // Clear references
    recognitionRequest = nil;
    recognitionTask = nil;
    
    // Recreate audio engine fresh for next recording
    // This prevents state corruption and delays on subsequent recordings
    audioEngine = nil;
    
    transcriptionCallback = NULL;
}

// Initialize the speech recognition system
void speech_initialize(void) {
    if (speechRecognizer == nil) {
        speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"en-US"]];
    }
    if (audioEngine == nil) {
        audioEngine = [[AVAudioEngine alloc] init];
    }
}

// Request authorization for speech recognition
void speech_request_authorization(void (*callback)(bool)) {
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus authStatus) {
        dispatch_async(dispatch_get_main_queue(), ^{
            callback(authStatus == SFSpeechRecognizerAuthorizationStatusAuthorized);
        });
    }];
}

// Start recording and recognizing speech
bool speech_start_recording(TranscriptionCallback callback) {
    speech_initialize();
    
    // Clear any previous transcription
    lastTranscription = nil;
    
    // Check authorization first
    SFSpeechRecognizerAuthorizationStatus authStatus = [SFSpeechRecognizer authorizationStatus];
    if (authStatus != SFSpeechRecognizerAuthorizationStatusAuthorized) {
        NSLog(@"Speech recognition not authorized. Status: %ld", (long)authStatus);
        return false;
    }
    
    // Check if recognizer is available
    if (speechRecognizer == nil || !speechRecognizer.isAvailable) {
        NSLog(@"Speech recognizer not available");
        return false;
    }
    
    transcriptionCallback = callback;
    
    // Cancel any ongoing task and cleanup
    if (recognitionTask != nil) {
        [recognitionTask cancel];
        recognitionTask = nil;
    }
    
    // Ensure clean state
    safelyRemoveTap();
    
    // Reinitialize audio engine if needed
    if (audioEngine == nil) {
        audioEngine = [[AVAudioEngine alloc] init];
    }
    
    // Create and configure recognition request
    recognitionRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    if (recognitionRequest == nil) {
        NSLog(@"Failed to create recognition request");
        return false;
    }
    
    recognitionRequest.shouldReportPartialResults = YES;
    
    // Get audio input node
    AVAudioInputNode *inputNode = audioEngine.inputNode;
    if (inputNode == nil) {
        NSLog(@"[SpeechBridge] Failed to get audio input node");
        return false;
    }
    
    // Configure audio tap BEFORE starting recognition task
    AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];
    if (recordingFormat == nil) {
        NSLog(@"[SpeechBridge] Failed to get recording format");
        return false;
    }
    
    NSLog(@"[SpeechBridge] Installing audio tap...");
    @try {
        [inputNode installTapOnBus:0
                        bufferSize:1024
                            format:recordingFormat
                             block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
            if (recognitionRequest != nil) {
                [recognitionRequest appendAudioPCMBuffer:buffer];
            }
        }];
        tapInstalled = YES;
        NSLog(@"[SpeechBridge] Audio tap installed successfully");
    } @catch (NSException *exception) {
        NSLog(@"[SpeechBridge] Failed to install audio tap: %@", exception.reason);
        return false;
    }
    
    // Start audio engine BEFORE starting recognition task
    [audioEngine prepare];
    NSError *audioError = nil;
    BOOL audioStarted = [audioEngine startAndReturnError:&audioError];
    
    if (!audioStarted || audioError != nil) {
        NSLog(@"[SpeechBridge] Audio engine failed to start: %@", audioError);
        safelyRemoveTap();
        return false;
    }
    
    NSLog(@"[SpeechBridge] Audio engine started successfully");
    
    // NOW start recognition task
    NSLog(@"[SpeechBridge] Starting recognition task...");
    recognitionTask = [speechRecognizer recognitionTaskWithRequest:recognitionRequest
                                                     resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
        if (error != nil) {
            NSLog(@"[SpeechBridge] Recognition error: %@ (domain: %@, code: %ld)", 
                  error.localizedDescription, error.domain, (long)error.code);
        }
        
        if (result != nil) {
            NSString *transcription = result.bestTranscription.formattedString;
            bool isFinal = result.isFinal;
            
            NSLog(@"[SpeechBridge] Transcription: %@ (final: %d)", transcription, isFinal);
            
            // Store the last transcription (for when user manually stops)
            lastTranscription = [transcription copy];
            
            // Call the callback if still active
            if (transcriptionCallback != NULL) {
                const char *cString = [transcription UTF8String];
                transcriptionCallback(cString, isFinal);
            }
        }
        
        // Only clean up on error - let speech_stop_recording handle normal completion
        // This prevents race conditions between the callback and stop function
        if (error != nil) {
            NSLog(@"[SpeechBridge] Error occurred, cleaning up");
            cleanupRecognition();
        }
    }];
    
    if (recognitionTask == nil) {
        NSLog(@"[SpeechBridge] Failed to create recognition task");
        safelyRemoveTap();
        [audioEngine stop];
        return false;
    }
    
    NSLog(@"[SpeechBridge] Recognition task started successfully");
    return true;
}

// Stop recording
void speech_stop_recording(void) {
    NSLog(@"[SpeechBridge] speech_stop_recording called");
    
    // Emit the last transcription as final before cleanup
    // This ensures any interim text gets saved when user manually stops
    if (lastTranscription != nil && lastTranscription.length > 0 && transcriptionCallback != NULL) {
        NSLog(@"[SpeechBridge] Emitting final transcription: %@", lastTranscription);
        const char *cString = [lastTranscription UTF8String];
        transcriptionCallback(cString, true);  // true = isFinal
    }
    
    // Clear last transcription
    lastTranscription = nil;
    
    cleanupRecognition();
}

// Check if speech recognition is available
bool speech_is_available(void) {
    SFSpeechRecognizerAuthorizationStatus status = [SFSpeechRecognizer authorizationStatus];
    if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
        return false;
    }
    
    if (speechRecognizer == nil) {
        speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"en-US"]];
    }
    
    return speechRecognizer != nil && speechRecognizer.isAvailable;
}
