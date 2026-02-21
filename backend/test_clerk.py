import asyncio
from app.services.clerk_sync import sync_user_to_clerk

async def main():
    try:
        print("Testing Clerk Sync with provided keys...")
        await sync_user_to_clerk(
            email="testscript@example.com",
            password="testpassword123",
            full_name="Script Test User"
        )
        print("Success! The keys are working and the user was created in Clerk.")
    except Exception as e:
        print(f"FAILED: Clerk threw an error:")
        print(e)

if __name__ == "__main__":
    asyncio.run(main())
