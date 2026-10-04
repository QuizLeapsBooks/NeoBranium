export async function getResolvedNeoLearnUser(auth) {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Please sign in to view NeoLearn social data.');
  return auth.currentUser;
}
