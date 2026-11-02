# Applied to the verifier bb writes (circuits/build.sh). Word boundaries: [[:<:]] [[:>:]] on macOS sed.
s/[[:<:]]BaseZKHonkVerifier[[:>:]]/ZkswapGateBase/g
s/[[:<:]]HonkVerifier[[:>:]]/ZkswapGateCheck/g
s/[[:<:]]HonkVerificationKey[[:>:]]/ZkswapGateKey/g
s/[[:<:]]Honk[[:>:]]/ZkswapProofShape/g
s/[[:<:]]Errors[[:>:]]/ZkswapGateErrors/g
s/[[:<:]]FrLib[[:>:]]/ZkswapFieldOps/g
s/[[:<:]]ZKTranscriptLib[[:>:]]/ZkswapFiatTape/g
s/[[:<:]]ZKTranscript[[:>:]]/ZkswapFiatState/g
s/[[:<:]]RelationsLib[[:>:]]/ZkswapRelationSet/g
s/[[:<:]]CommitmentSchemeLib[[:>:]]/ZkswapOpeningOps/g
s/[[:<:]]IVerifier[[:>:]]/IZkswapGateCheck/g
