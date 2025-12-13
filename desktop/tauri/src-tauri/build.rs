fn main() {
    tauri_build::build();
    
    #[cfg(target_os = "macos")]
    {
        // Compile Objective-C bridge for speech recognition
        cc::Build::new()
            .file("src/speech_bridge.m")
            .flag("-fobjc-arc")
            .compile("speech_bridge");
        
        // Link required macOS frameworks for A/V functionality
        println!("cargo:rustc-link-lib=framework=Speech");
        println!("cargo:rustc-link-lib=framework=AVFoundation");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
}
