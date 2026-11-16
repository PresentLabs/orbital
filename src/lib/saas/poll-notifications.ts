/** Read state is independent of participation: opening an invitation is not a vote. */
export function awaitingPollVote(poll: {
  canVote: boolean;
  myVote?: number;
  total: number;
  recipients: string[];
}) {
  return (
    poll.canVote &&
    poll.myVote === undefined &&
    poll.total < poll.recipients.length
  );
}
