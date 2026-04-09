import os
import time
import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright
from supabase import create_client, Client

# --- CONFIGURATION ---
# These should be passed as environment variables or entered on first run
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qsihibelwwwlwxyypumf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "") # Service Role or Anon Key
HOSPITAL_ID = os.environ.get("HOSPITAL_ID", "")
SECRET_KEY = os.environ.get("SECRET_KEY", "")

# Path to store the browser session (so you only scan QR once)
SESSION_FILE = f"sessions/{HOSPITAL_ID}_session"

class WhatsAppAgent:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.browser = None
        self.context = None
        self.page = None

    async def init_browser(self):
        """Initialize playwright and load the WhatsApp Web page."""
        p = await async_playwright().start()
        
        # Ensure session directory exists
        if not os.path.exists("sessions"):
            os.makedirs("sessions")

        # Launch browser with persistent context
        self.context = await p.chromium.launch_persistent_context(
            user_data_dir=SESSION_FILE,
            headless=True,  # Set to False to see the QR code on first run
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        self.page = await self.context.new_page()
        print("Opening WhatsApp Web...")
        await self.page.goto("https://web.whatsapp.org")

        # Check if we need to scan QR
        try:
            # Look for the QR code canvas
            qr_selector = 'canvas[aria-label="Scan me!"]'
            await self.page.wait_for_selector(qr_selector, timeout=10000)
            print("\n" + "="*50)
            print("ACTION REQUIRED: PLEASE SCAN THE QR CODE ON YOUR SCREEN")
            print("Wait... I am a background script. Please run in non-headless mode for the first run.")
            print("="*50 + "\n")
            
            # Note: In a real implementation, we'd provide a way to see the QR.
            # For this MVP, we'll assume the user runs it once with headless=False.
        except Exception:
            print("Session found. Logged in successfully.")

    async def send_message(self, number: str, message: str):
        """Send a message to a specific number using WhatsApp Web URL scheme."""
        try:
            print(f"Sending message to {number}...")
            # Clean number: ensure it's just digits
            clean_number = "".join(filter(str.isdigit, number))
            if not clean_number.startswith("91"): # Default to India if no prefix
                clean_number = "91" + clean_number

            # Use the direct chat URL
            url = f"https://web.whatsapp.org/send?phone={clean_number}&text={message}"
            await self.page.goto(url)

            # Wait for the send button to appear and become clickable
            # Selector for the send button (this can change if WhatsApp updates their UI)
            send_button_selector = 'button[aria-label="Send"]'
            await self.page.wait_for_selector(send_button_selector, timeout=30000)
            await self.page.click(send_button_selector)
            
            # Wait a bit to ensure it's sent
            await asyncio.sleep(3)
            return True, None
        except Exception as e:
            print(f"Failed to send message: {e}")
            return False, str(e)

    async def poll_and_process(self):
        """Fetch pending messages from Supabase and send them."""
        while True:
            try:
                # 1. Update Heartbeat
                self.supabase.table("whatsapp_configs").update({
                    "last_heartbeat": datetime.now().isoformat()
                }).eq("hospital_id", HOSPITAL_ID).execute()

                # 2. Fetch pending messages
                res = self.supabase.table("whatsapp_outbox").select("*").eq("hospital_id", HOSPITAL_ID).eq("status", "pending").limit(5).execute()
                messages = res.data

                if not messages:
                    # print("No pending messages. Sleeping...")
                    await asyncio.sleep(10)
                    continue

                for msg in messages:
                    # Mark as processing
                    self.supabase.table("whatsapp_outbox").update({"status": "processing"}).eq("id", msg["id"]).execute()

                    success, error = await self.send_message(msg["recipient_number"], msg["message_body"])

                    if success:
                        self.supabase.table("whatsapp_outbox").update({
                            "status": "sent",
                            "sent_at": datetime.now().isoformat(),
                            "processed_at": datetime.now().isoformat()
                        }).eq("id", msg["id"]).execute()
                    else:
                        self.supabase.table("whatsapp_outbox").update({
                            "status": "failed",
                            "error_message": error,
                            "processed_at": datetime.now().isoformat()
                        }).eq("id", msg["id"]).execute()

            except Exception as e:
                print(f"Polling error: {e}")
                await asyncio.sleep(30)

async def main():
    if not (HOSPITAL_ID and SECRET_KEY):
        print("Error: HOSPITAL_ID and SECRET_KEY must be set.")
        return

    agent = WhatsAppAgent()
    await agent.init_browser()
    await agent.poll_and_process()

if __name__ == "__main__":
    asyncio.run(main())
