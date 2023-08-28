#import telegram bot tools
from configuration import TELEGRAM_BOT_TOKEN, CHAT_ID
import telebot

tb = telebot.TeleBot(TELEGRAM_BOT_TOKEN)

def sendNotification(title,textmessage,chatID = None):
    text = "<strong>" + title + "</strong>\n" + textmessage 
    
    if chatID == None:
        tb.send_message(CHAT_ID, text,parse_mode='HTML')
    else:
        tb.send_message(chatID, text,parse_mode='HTML')
        #tb.send_message(chatID, text,parse_mode='markdown')
    return 