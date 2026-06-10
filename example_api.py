from openai import OpenAI

client = OpenAI(
    api_key="votre_cle_api_ici"
)

response = client.responses.create(
    model="gpt-4.1-mini",
    input="Write a one-sentence bedtime story about a unicorn."
)

print(response.output_text)