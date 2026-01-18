import sys
import os
import asyncio
import json
import argparse
import traceback

# Add the mcp_server directory to sys.path to import veo3
# Assuming we are running from backend-nodejs root or similar
# We need to find D:\Dropbox\0000google\87boss_banana\87boss-veo31-ok\mcp_server

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', required=True)
    parser.add_argument('--duration', type=int, default=8)
    parser.add_argument('--aspect_ratio', default="16:9")
    parser.add_argument('--key_file', required=True)
    parser.add_argument('--image_uri', help="GCS URI for start frame image", default=None)
    parser.add_argument('--end_image_uri', help="GCS URI for end frame image", default=None)
    args = parser.parse_args()

    try:
        # 1. Setup Environment
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = args.key_file
        
        # 2. Add library path
        # Script is in backend-nodejs/scripts/run_veo.py
        # We need to go up to 87boss_banana, then into 87boss-veo31-ok/mcp_server
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(current_dir)) # Up to 87boss_banana
        veo_dir = os.path.join(project_root, '87boss-veo31-ok', 'mcp_server')
        
        if veo_dir not in sys.path:
            sys.path.append(veo_dir)
            
        # 3. Import function
        from veo3 import generate_video
        
        # 4. Run generation
        # generate_video returns a MediaAsset which likely has a 'gcs_uri' or similar or is a pydantic model
        result = asyncio.run(generate_video(
            prompt=args.prompt,
            video_duration_seconds=args.duration,
            aspect_ratio=args.aspect_ratio,
            start_frame_image_gsc_uri=args.image_uri,
            end_frame_image_gsc_uri=args.end_image_uri
        ))
        
        # 5. Output Result
        # veo3.py returns MediaAsset(uri="gs://...", error=...)
        # We need to access .uri property
        
        response_data = {
            "success": True, 
            "gcsUri": result.uri if hasattr(result, 'uri') else str(result)
        }
        
        if hasattr(result, 'error') and result.error:
             response_data['error'] = result.error
             # If there implies success=False? mcp code says it returns asset with error text.
             # but let's pass it anyway.
        
        print(json.dumps(response_data))
        
    except Exception as e:
        # Print error as JSON
        print(json.dumps({
            "success": False, 
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
