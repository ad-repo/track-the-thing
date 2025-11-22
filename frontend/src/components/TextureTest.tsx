import { generateTexture } from '../services/textureGenerator';

/**
 * Simple test component to verify textures render correctly
 */
export default function TextureTest() {
  const noiseTexture = generateTexture('noise', {
    scale: 1.0,
    opacity: 0.8, // Very high for testing
    density: 0.7,
    angle: 0,
    blendMode: 'normal', // Use normal blend for maximum visibility
    seed: Date.now(),
  });

  const rivetsTexture = generateTexture('rivets', {
    scale: 1.0,
    opacity: 0.8,
    density: 0.7,
    angle: 0,
    blendMode: 'normal',
    seed: Date.now(),
  });

  console.log('[TextureTest] Noise texture length:', noiseTexture?.length);
  console.log('[TextureTest] Rivets texture length:', rivetsTexture?.length);
  console.log('[TextureTest] Noise starts with:', noiseTexture?.substring(0, 50));

  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a' }}>
      <h2 style={{ color: 'white', marginBottom: '20px' }}>Texture Test</h2>
      
      {/* Test 1: Direct inline background */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: 'white' }}>Test 1: Direct Inline Background (Noise)</h3>
        <div
          style={{
            width: '300px',
            height: '200px',
            backgroundColor: '#ffffff',
            backgroundImage: `url(${noiseTexture})`,
            backgroundSize: 'auto',
            backgroundRepeat: 'repeat',
            border: '2px solid red',
          }}
        >
          <p style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.8)' }}>
            If you see a texture behind this text, textures work!
          </p>
        </div>
      </div>

      {/* Test 2: With blend mode */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: 'white' }}>Test 2: With Overlay Blend (Rivets)</h3>
        <div
          style={{
            width: '300px',
            height: '200px',
            backgroundColor: '#3498db',
            backgroundImage: `url(${rivetsTexture})`,
            backgroundSize: 'auto',
            backgroundRepeat: 'repeat',
            backgroundBlendMode: 'overlay',
            border: '2px solid red',
          }}
        >
          <p style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.8)' }}>
            If you see a texture, blend modes work!
          </p>
        </div>
      </div>

      {/* Test 3: Just the data URL as an img tag */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: 'white' }}>Test 3: Data URL as IMG tag</h3>
        <img 
          src={noiseTexture} 
          alt="Texture" 
          style={{ 
            width: '300px', 
            height: '200px', 
            border: '2px solid red',
            backgroundColor: 'white' 
          }} 
        />
      </div>

      {/* Test 4: Multiple backgrounds */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: 'white' }}>Test 4: Color + Texture (Multiple Backgrounds)</h3>
        <div
          style={{
            width: '300px',
            height: '200px',
            background: `url(${noiseTexture}), linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
            backgroundSize: 'auto, cover',
            backgroundRepeat: 'repeat, no-repeat',
            backgroundBlendMode: 'overlay, normal',
            border: '2px solid red',
          }}
        >
          <p style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.8)' }}>
            Multiple background test
          </p>
        </div>
      </div>
    </div>
  );
}

