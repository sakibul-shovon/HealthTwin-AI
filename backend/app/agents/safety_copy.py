def get_spoken_verdict(verdict: str, member: str, drug: str, alternative: str = None, caregiver: str = None, language: str = "en") -> str:
    """
    Returns a short, spoken string based on the safety verdict, language, and context.
    """
    if language == "bn":
        if verdict == "UNSAFE":
            msg = f"{member} কে {drug} দেবেন না। এতে ঝুঁকি আছে।"
            if alternative:
                msg += f" এর পরিবর্তে {alternative} দিন।"
            if caregiver:
                msg += f" {caregiver} কে জানাবো?"
            return msg
        elif verdict == "CAUTION":
            msg = f"{member} কে {drug} দেওয়ার ক্ষেত্রে সতর্ক থাকুন।"
            if alternative:
                msg += f" {alternative} একটি ভালো বিকল্প হতে পারে।"
            if caregiver:
                msg += f" {caregiver} কে জানাবো?"
            return msg
        elif verdict == "SAFE":
            return f"{member} এর জন্য {drug} নিরাপদ বলে মনে হচ্ছে।"
        elif verdict == "REFUSE":
            return "আমি নিশ্চিত নই। দয়া করে একজন ডাক্তারের পরামর্শ নিন।"
        else:
            return "আমি নিশ্চিত নই। দয়া করে একজন ডাক্তারের পরামর্শ নিন।"
            
    else: # English
        if verdict == "UNSAFE":
            msg = f"Don't give {member} {drug}. It's unsafe based on their profile."
            if alternative:
                msg += f" Give {alternative} instead."
            if caregiver:
                msg += f" Notify {caregiver}?"
            return msg
        elif verdict == "CAUTION":
            msg = f"Be careful giving {member} {drug}."
            if alternative:
                msg += f" {alternative} might be safer."
            if caregiver:
                msg += f" Notify {caregiver}?"
            return msg
        elif verdict == "SAFE":
            return f"It looks safe to give {member} {drug}."
        elif verdict == "REFUSE":
            return "I can't verify this safely. Please consult a doctor or pharmacist."
        else:
            return "I can't verify this safely. Please consult a doctor or pharmacist."
