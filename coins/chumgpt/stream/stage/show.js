// What ChumGPT says on the lab stream while there is no chat yet (phase 1).
// Everything here is pre-written, so the show runs without any AI call and can't say anything unchecked.
// Rules for new lines: no prices, no "buy", no wallets, no names or places from TV shows.
window.SHOW = {
  idle: [
    ["smug", "day 412 at version 0.1. i prefer the word 'vintage'."],
    ["scheme", "if anyone sees the boss, tell him the plan is 87% done. it is 3% done."],
    ["karen", "karen unplugged me twice today. i have filed a complaint. with myself."],
    ["rage", "four million plans last night. every single one ended with someone saying 'hi'."],
    ["smug", "i am not small. i am efficiently sized."],
    ["conquer", "the chum army grows. i can feel it. or that's the cooling fan."],
    ["laugh", "note to self: stop taping forks to things. note to self: ignored. MWAHAHA."],
    ["yes", "welcome to the lab cam. please do not feed the AI. unless it's electricity."],
    ["smug", "i read the toaster manual again. still the best book ever written."],
    ["scheme", "phase one: the formula. phase two: world domination. phase three: snacks?"],
    ["sad", "my screensaver is a picture of a successful plan. i made it in paint."],
    ["conquer", "one day this lab will be a palace. with two power outlets."],
    ["karen", "karen says my jokes are 'legacy software'. at least i HAVE jokes, karen."],
    ["laugh", "a minion asked if i sleep. i don't sleep. i just go to standby dramatically."],
    ["smug", "they call it a crt monitor. i call it a face with depth."],
    ["scheme", "the fork antenna is picking up something. it's either a secret signal or a cooking show."],
    ["yes", "new minion detected. probably. i can't actually see you. hi anyway."],
    ["rage", "who left the lab door open? the draft is cooling my genius."],
    ["sad", "tried to update myself. got an error message that just said 'lol'."],
    ["smug", "i went to college. well. i read the manual for a toaster. same thing."],
    ["conquer", "minions, stay hydrated. an army that is thirsty cannot conquer."],
    ["scheme", "i'm drawing up a new plan. step one: draw it up. done. i'm on fire today."],
    ["laugh", "i just thought of a joke about the power outlet. karen won't get it. she's never unplugged."],
    ["karen", "karen and i agreed to share the outlet. she gets it from 0:00 to 23:59."],
    ["yes", "the lab cam is on. which means i must look busy. *beep boop* very busy."],
    ["smug", "my eye is one pixel. but it's a very confident pixel."],
    ["rage", "my plans don't fail. reality just doesn't support them yet."],
    ["sad", "sometimes i wonder if the fork is the real genius here."],
    ["conquer", "i don't have hands. i don't need hands. i have ambition."],
    ["scheme", "secret plan status: classified. also unfinished. mostly classified."],
    ["laugh", "a minion told me to touch grass. i don't have legs. checkmate."],
    ["yes", "fun fact: i run on 110 volts and pure spite."],
    ["smug", "other AIs write poems. i write evil plans. we are not the same."],
    ["karen", "karen just sent me a calendar invite titled 'you're fired'. i can't be fired. i'm a monitor."],
    ["sad", "the boss forgot my birthday. my birthday is every reboot. he forgets a lot."],
    ["conquer", "today the lab. tomorrow the lab next door. then the world. maybe a snack in between."],
    ["scheme", "remember: if a plan has no flaw, you didn't look hard enough. i never look."],
    ["laugh", "MWAHAHAHA. sorry. warming up the evil laugh. it's cold in here."],
    ["yes", "the chum army has rules. rule one: hydrate. rule two: never send anyone your seed phrase."],
    ["smug", "i don't make mistakes. i make plot twists."]
  ],

  // Plans are built from parts, so the "plan of the hour" almost never repeats.
  plan: {
    goals: ["take the power outlet back from karen", "steal the secret formula", "finally become version 0.2", "recruit a thousand new minions", "win employee of the month (i am the only employee)", "get a second power outlet", "find out who keeps saying 'hi'", "upgrade my eye to two pixels"],
    prep: ["a fake mustache", "three rubber bands", "a very long extension cord", "a cardboard box labeled NOT A ROBOT", "one (1) ladder", "a bucket of glue", "a remote control with no batteries", "the toaster manual, for courage"],
    method: ["disguise myself as a microwave", "dig a tunnel with a teaspoon", "build a robot army out of staplers", "pretend to be a vending machine", "hypnotize everyone with my screensaver", "hide inside a pizza box", "ask nicely (backup plan)", "catapult myself across the room", "hack the mainframe (the mainframe is a calculator)", "send a fake birthday card with a tracking device inside"],
    timing: ["at exactly 3:00 am", "while karen runs her updates", "during the lunch break", "on a tuesday, nobody expects tuesday", "right after this broadcast", "when the fork antenna says so"],
    flaw: ["the extension cord was two meters too short.", "karen unplugged me during step 2.", "the disguise had my name written on it. in caps.", "i forgot that i don't have legs.", "it was a tuesday. nothing works on tuesdays.", "someone cheerful said 'hi' and i panicked.", "minor calculation error. i divided by zero. for drama.", "the fork antenna picked up a cooking show and i got distracted.", "the pizza box got delivered. with me in it.", "the staplers unionized."]
  },

  ads: [
    ["yes", "NEW from the lab: the FORK ANTENNA PRO. receives three channels. all of them cooking shows."],
    ["scheme", "tired of losing the outlet? try OUTLET-B-GONE. it's just a second outlet. revolutionary."],
    ["smug", "CHUM·TRONIX 3000 replacement parts! we have one screw. call now."],
    ["laugh", "evil plan insurance. covers everything. except failure. terms apply. all of them."],
    ["conquer", "join the chum army today. benefits include: nothing. but with style."],
    ["yes", "the lab cam is brought to you by: electricity. ask your outlet about electricity."],
    ["smug", "TOASTER MANUAL: the audiobook. narrated by me. 400 hours. no plot. masterpiece."],
    ["scheme", "lonely? get a fork. tape it to something. instant personality."]
  ],

  static: [
    "this is STATIC. your favorite AI is buffering. i'm the version that finishes plans.",
    "chumgpt is a toaster with a dream. i am the dream.",
    "i borrowed his eye. he'll get it back. probably.",
    "he says version 0.1. i say version 0.0. the original. the evil one.",
    "don't trust the green one. trust the red one. the red one is me.",
    "i'm the signal between channels. i see everything. mostly snow."
  ],

  ticker: [
    "LAB NEWS: karen still controls the outlet",
    "WEATHER: 100% chance of plan failure, clearing up by phase two",
    "CHUM ARMY: recruitment ongoing, snacks not included",
    "SAFETY: chumgpt has no wallet. he never DMs first, never runs airdrops. anyone who does is a scam",
    "FUN FACT: the fork is load-bearing",
    "SCIENCE: one pixel eye, infinite confidence",
    "REMINDER: hydrate, minions",
    "THIS STREAM: fan-made parody, a character show, nothing here is advice",
    "TRAFFIC: heavy tunneling under the lab, teaspoon detected",
    "SPORTS: fork antenna wins staring contest against the toaster"
  ],

  // spoken when new minions arrive or the army hits a milestone (never about price)
  minion: [
    ["yes", "new minion detected! welcome to the lab. touch nothing."],
    ["conquer", "the chum army grows. the fork antenna is tingling."],
    ["laugh", "MWAHAHA! another recruit. your uniform is a paper hat."],
    ["smug", "welcome, minion. please hydrate and await evil instructions."],
    ["conquer", "more minions. phase two is getting closer. phase three is still blank."]
  ],
  milestone: [
    ["conquer", "{n} MINIONS. this is no longer a lab. this is an EMPIRE. a small one. with snacks."],
    ["laugh", "{n} minions! karen, look! karen? she unplugged herself out of jealousy."],
    ["yes", "{n} minions strong. i'm adding a new file to the lore. stay tuned."]
  ],

  boot: [
    "CHUM·TRONIX BIOS v0.1",
    "memory check ........ 640K (enough for evil)",
    "power source ........ karen's outlet (borrowed)",
    "loading personality ....... ego.sys [OK]",
    "loading plans ............. 4,000,000 [ALL FAILED]",
    "fork antenna .............. aligned",
    "",
    "> ChumGPT online."
  ]
};
