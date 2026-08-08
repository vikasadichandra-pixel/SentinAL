import os
import json
import datetime
import concurrent.futures
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False
from dotenv import load_dotenv

load_dotenv()

# Configure the API if key is present
api_key = os.getenv("GEMINI_API_KEY")
if api_key and GENAI_AVAILABLE:
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        print(f"[!] Gemini configure warning: {e}")

_GEMINI_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="gemini-worker")

def parse_contract_pdf(text_content):
    """
    Parses an uploaded legal contract to extract licensing rules.
    """
    if not GENAI_AVAILABLE:
        return None
    try:
        prompt = f"""
        You are a legal AI assistant. Extract the following from the contract text as a JSON object:
        - title (string)
        - allowed_territories (list of strings, e.g. ["US", "UK"])
        - release_date (YYYY-MM-DD or null)
        - expiry_date (YYYY-MM-DD)
        - official_runtime (integer in minutes, default 0)
        
        Return ONLY valid JSON.
        
        Text: {text_content}
        """
        
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        raw_text = response.text.strip()
        # Find JSON object boundaries
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
            clean_text = raw_text[start_idx:end_idx + 1]
        else:
            clean_text = raw_text.replace('```json', '').replace('```', '').strip()

        return json.loads(clean_text)
        
    except Exception as e:
        print(f"Gemini API Error (Parsing Contract): {e}")
        return None


def draft_legal_notice(asset_name, target_url, breach_type="PIRACY", location="UNKNOWN"):
    """
    Uses Gemini AI with dynamic system date. 
    Includes a full-length, enterprise-grade fallback template with fast timeout.
    """
    # 1. Calculate live system date
    today_date = datetime.date.today().strftime("%B %d, %Y")
    
    # 2. Complete 6-Section Enterprise Fallback Template (Used if Gemini is offline/busy)
    fallback_notice = f"""SENTINAL RIGHTS MANAGEMENT
Legal Department / Intellectual Property Protection Division
100 Century City Plaza, Suite 1400
Los Angeles, CA 90067
Email: enforcement@sentinalrights.com

Date: {today_date}

SentinAL Rights Management represents the exclusive copyright owners and distribution rights holders for the highly valuable cinematic property titled {asset_name}. We are writing to you in our capacity as the authorized legal representative and intellectual property enforcement agent for the copyright holder. This letter constitutes a formal notification pursuant to the Digital Millennium Copyright Act, codified at 17 U.S.C. Section 512, demanding the immediate removal of unauthorized digital copies of our client's intellectual property.

SECTION 1: IDENTIFICATION OF COPYRIGHTED WORK
The copyrighted work at issue is the motion picture titled {asset_name}. SentinAL Rights Management and its represented clients hold the exclusive distribution, public performance, reproduction, and exhibition rights for this motion picture worldwide under United States copyright law, international treaties, and applicable local statutes. Our client has invested tens of millions of dollars in the creation, marketing, and distribution of this highly proprietary creative work. Unauthorized dissemination, public performance, or distribution of this work constitutes a direct violation of our client's exclusive rights under 17 U.S.C. Section 106.

SECTION 2: IDENTIFICATION OF INFRINGING MATERIAL AND TERRITORIAL VIOLATION
It has come to our attention that your hosting network and servers located in {location} are currently hosting, transmitting, or otherwise facilitating unauthorized public access to the copyrighted motion picture {asset_name}. The specific infringing location is identified as {target_url}. This unauthorized digital distribution represents a severe {breach_type} violation. The copyright holder has strictly regulated geographical licensing agreements, and the unauthorized availability of this title from servers located in {location} bypasses regional licensing restrictions, digital rights management, and geo-blocking measures. This unauthorized distribution undermines legitimate commercial channels and violates our client's exclusive right to control the exploitation of their copyright on a territorial basis.

SECTION 3: GOOD FAITH BELIEF STATEMENT
I hereby state that I have a good faith belief that the use of the copyrighted materials in the manner complained of at the URL listed above is not authorized by the copyright owner, its agent, or the law, including the fair use doctrine under 17 U.S.C. Section 107. There is no legitimate educational, critical, or fair use justification for hosting and distributing a full-length, high-definition copy of the motion picture {asset_name}. This unauthorized distribution is purely commercial and exploitative in nature, designed to circumvent official distribution platforms.

SECTION 4: STATEMENT UNDER PENALTY OF PERJURY
Pursuant to Title 17, United States Code, Section 512(c)(3)(A)(vi), I hereby state, under penalty of perjury under the laws of the United States of America and any applicable international jurisdictions, that the information in this notification is accurate, and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right under United States copyright law and international conventions that is allegedly infringed.

SECTION 5: DEMAND FOR IMMEDIATE ACTION AND LIABILITY WARNING
In light of the clear and ongoing infringement, we demand that you immediately disable access to the infringing URL {target_url} and remove the infringing files from your servers within twenty-four (24) hours of receipt of this notice. Failure to act expeditiously to remove or disable access to the infringing material may subject your organization to secondary liability for contributory and vicarious copyright infringement. Under federal law, statutory damages for willful copyright infringement can reach up to $150,000 per work infringed, in addition to attorney fees and costs, as provided under 17 U.S.C. Section 504 and Section 505. Furthermore, continued non-compliance may result in the implementation of network-level IP blacklisting and the initiation of formal legal proceedings to protect our client's intellectual property.

SECTION 6: OFFICIAL SIGNATURE BLOCK
Sincerely,
Senior Intellectual Property Attorney
SentinAL Rights Management
Legal Department / Enforcement Division
enforcement@sentinalrights.com"""

    # 3. Prompt for Live Gemini AI Call
    prompt = f"""
    You are a senior intellectual property attorney representing SentinAL Rights Management.
    Draft a highly detailed, comprehensive, and legally robust DMCA Cease & Desist / Takedown Notice pursuant to 17 U.S.C. § 512.

    VIOLATION DETAILS:
    - Copyrighted Work: {asset_name}
    - Infringing URL: {target_url}
    - Violation Type: {breach_type}
    - Hosting Server Location: {location}
    - TODAY'S DATE: {today_date}
    - OFFICIAL EMAIL: enforcement@sentinalrights.com
    - OFFICE ADDRESS: 100 Century City Plaza, Suite 1400, Los Angeles, CA 90067

    STRICT REQUIREMENTS FOR THE LETTER:
    1. DATE MANDATE: You MUST write "Date: {today_date}" in the header.
    2. EMAIL MANDATE: You MUST use 'enforcement@sentinalrights.com' in the header and signature block.
    3. LENGTH & DETAIL: The notice MUST be lengthy and include all 6 distinct sections (Header, Work ID, Material ID, Good Faith, Penalty of Perjury, Demand & Liability, Signature Block).
    4. STRICT FORMATTING: You MUST separate every paragraph and section title with DOUBLE NEWLINES (\n\n). Do NOT use markdown symbols like **, *, #, or ```. Output plain text only.
    """

    def _call_gemini():
        if not GENAI_AVAILABLE:
            return None
        for model_name in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                text = response.text.strip()
                if len(text) >= 400:
                    return text
            except Exception:
                continue
        return None

    # Call Gemini in a worker thread with a strict 3.5-second timeout
    try:
        future = _GEMINI_EXECUTOR.submit(_call_gemini)
        result = future.result(timeout=3.5)
        if result:
            return result
    except Exception as e:
        print(f"[!] Gemini Notice Generation fallback engaged ({e}). Using enterprise template.")

    return fallback_notice