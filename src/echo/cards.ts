import {
  firstPlayMonth,
  formatSpan,
  hoarderVerdict,
  listenerType,
  pickOne,
  queueOutlook,
  wholeHours,
  type EchoYear,
} from './echo';

export type EchoBackdrop = 'bubbles' | 'waveform' | 'stripes' | 'squares' | 'waves';

/** One story card's words, in AntennaPod's four slots, plus its backdrop. */
export type EchoCard = {
  key: string;
  backdrop: EchoBackdrop;
  above: string;
  large: string;
  below: string;
  small: string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The first six cards' text (the seventh, the top podcasts, is drawn by the
 * screen). Wording follows AntennaPod's Echo strings. `seed` in [0, 1)
 * picks the podcast the hoarder card suggests.
 */
export function echoCards(echo: EchoYear, now: number, seed: number): EchoCard[] {
  const nextYear = echo.year + 1;

  const hours = wholeHours(echo.listenedSeconds);
  const outlook = queueOutlook(echo.queueSeconds, now);
  const perDay = formatSpan(outlook.perDaySeconds * 1000);
  const queueEnding =
    outlook.tone === 'clean'
      ? ''
      : outlook.tone === 'many'
        ? ' You can start the year clean if you skip a few episodes.'
        : ' Wait, what?';

  return [
    {
      key: 'intro',
      backdrop: 'bubbles',
      above: 'Your year',
      large: String(echo.year),
      below: 'in podcasts',
      small: 'Worked out privately on your phone',
    },
    {
      key: 'hours',
      backdrop: 'waveform',
      above: 'This year you played',
      large: String(hours),
      below: `${plural(hours, 'hour', 'hours')} of episodes\nfrom ${echo.podcastsPlayed} ${plural(
        echo.podcastsPlayed,
        'podcast',
        'different podcasts'
      )}`,
      small: '',
    },
    {
      key: 'queue',
      backdrop: 'stripes',
      above:
        outlook.tone === 'clean'
          ? 'And you’re ready to make a clean start to the year. You have'
          : 'And you still have quite a bit to go this year. You have',
      large: String(wholeHours(echo.queueSeconds)),
      below: `hours waiting in your queue\nfrom ${echo.queueEpisodes} ${plural(echo.queueEpisodes, 'episode', 'episodes')}`,
      small: `That’s about ${perDay} each day until ${nextYear} starts.${queueEnding}`,
    },
    delayCard(echo.medianDelayMs),
    hoarderCard(echo, seed),
    {
      key: 'thanks',
      backdrop: 'squares',
      above: '',
      large: 'Thanks',
      below: thanksLine(echo),
      small: 'Now, let’s look at your favourite podcasts…',
    },
  ];
}

function delayCard(delayMs: number | null): EchoCard {
  const above = 'We looked at when episodes came out and when you finished them. Our conclusion?';
  if (delayMs === null) {
    return {
      key: 'delay',
      backdrop: 'squares',
      above,
      large: '🎧',
      below: 'Too early to tell',
      small: 'Finish a few of this year’s episodes and Echo will say how quickly you get to them.',
    };
  }
  const addict = listenerType(delayMs) === 'addict';
  return {
    key: 'delay',
    backdrop: 'squares',
    above,
    large: addict ? '🏃' : '🧘',
    below: addict ? 'You’re a podcast addict' : 'You’re easy going',
    small: `Typically, you finished an episode ${formatSpan(delayMs)} after it came out.`,
  };
}

function hoarderCard(echo: EchoYear, seed: number): EchoCard {
  const above = 'We also wondered: do you listen to the podcasts you’re subscribed to?';
  const total = echo.activeFeeds;
  if (total === 0) {
    return {
      key: 'hoarder',
      backdrop: 'waves',
      above,
      large: '📭',
      below: 'Nothing to count',
      small: 'None of your podcasts refresh automatically, so there’s nothing to check.',
    };
  }
  const { kind, percent } = hoarderVerdict(echo.playedActiveFeeds, total);
  const subscriptions = `${total} active ${plural(total, 'subscription', 'subscriptions')}`;
  if (kind === 'hoarder') {
    return {
      key: 'hoarder',
      backdrop: 'waves',
      above,
      large: '🗄️',
      below: 'Looking at the numbers, we think you’re a hoarder',
      small: `Numbers don’t lie, they say. Only ${percent}% of your ${subscriptions} were played this year.`,
    };
  }
  if (kind === 'medium') {
    const suggestion = pickOne(echo.unplayedActiveTitles, seed);
    return {
      key: 'hoarder',
      backdrop: 'waves',
      above,
      large: '✅',
      below: 'Check. No hoarding here.',
      small:
        `You played episodes from ${percent}% of your ${subscriptions} this year.` +
        (suggestion ? ` How about checking out “${suggestion}” again?` : ''),
    };
  }
  return {
    key: 'hoarder',
    backdrop: 'waves',
    above,
    large: '✨',
    below: 'Clean!',
    small: `You played episodes from ${percent}% of your ${subscriptions} this year. We bet you keep your desk clean, too!`,
  };
}

function thanksLine(echo: EchoYear): string {
  const since = firstPlayMonth(echo.firstDay, echo.year);
  return since
    ? `for sticking with Sage Pod this year!\n\nYou played your first episode here in ${since}. It’s been a pleasure since.`
    : 'for joining Sage Pod this year!\n\nWhether you moved over from another app or started your podcast adventure here, we’re glad to have you.';
}
