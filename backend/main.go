package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v9"
	"golang.org/x/crypto/bcrypt"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Poll struct { ID bson.ObjectID `bson:"_id,omitempty" json:"id"`; Question string `bson:"question" json:"question"`; Options []string `bson:"options" json:"options"`; CreatedBy string `bson:"createdBy" json:"createdBy"`; CreatedAt time.Time `bson:"createdAt" json:"createdAt"` }
type User struct { ID bson.ObjectID `bson:"_id,omitempty"`; Email string `bson:"email"`; PasswordHash string `bson:"passwordHash"`; CreatedAt time.Time `bson:"createdAt"` }
type Vote struct { Option string `json:"option"` }
type VoteRecord struct { PollID bson.ObjectID `bson:"pollId"`; Option string `bson:"option"`; CreatedAt time.Time `bson:"createdAt"` }
type Server struct { polls, users, votes *mongo.Collection; redis *redis.Client }

func main() {
	ctx := context.Background()
	client, err := mongo.Connect(options.Client().ApplyURI(mustEnv("MONGODB_URI"))); if err != nil { panic(err) }
	if err = client.Ping(ctx, nil); err != nil { panic(err) }
	rdb, err := redis.ParseURL(mustEnv("REDIS_URL")); if err != nil { panic(err) }
	db := client.Database(envOr("MONGODB_DATABASE", "pulsepoll"))
	s := &Server{polls: db.Collection("polls"), users: db.Collection("users"), votes: db.Collection("votes"), redis: redis.NewClient(rdb)}
	r := gin.Default(); r.Use(cors.New(cors.Config{AllowOrigins: []string{"*"}, AllowMethods: []string{"GET", "POST"}, AllowHeaders: []string{"Content-Type", "Authorization"}}))
	r.POST("/api/auth/signup", s.signup); r.POST("/api/auth/login", s.login)
	r.POST("/api/polls", s.requireAuth(), s.createPoll); r.GET("/api/polls/:id", s.getPoll); r.GET("/api/polls/:id/results", s.results); r.POST("/api/polls/:id/votes", s.vote); r.GET("/api/polls/:id/events", s.events)
	if err := r.Run(":" + envOr("PORT", "8080")); err != nil { panic(err) }
}

func (s *Server) signup(c *gin.Context) { var in struct{ Email, Password string }; if c.ShouldBindJSON(&in) != nil || !validCredentials(in.Email, in.Password) { c.JSON(400, gin.H{"error":"Use a valid email and a password of at least 8 characters"}); return }; email := strings.ToLower(strings.TrimSpace(in.Email)); hash, _ := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost); u := User{Email: email, PasswordHash: string(hash), CreatedAt: time.Now().UTC()}; if _, err := s.users.InsertOne(c, u); err != nil { c.JSON(409, gin.H{"error":"An account with that email already exists"}); return }; c.JSON(201, gin.H{"token": s.issueToken(c, u.ID.Hex()), "email": email}) }
func (s *Server) login(c *gin.Context) { var in struct{ Email, Password string }; if c.ShouldBindJSON(&in) != nil { c.JSON(401, gin.H{"error":"Invalid email or password"}); return }; var u User; err := s.users.FindOne(c, bson.M{"email": strings.ToLower(strings.TrimSpace(in.Email))}).Decode(&u); if err != nil || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) != nil { c.JSON(401, gin.H{"error":"Invalid email or password"}); return }; c.JSON(200, gin.H{"token": s.issueToken(c, u.ID.Hex()), "email": u.Email}) }
func (s *Server) requireAuth() gin.HandlerFunc { return func(c *gin.Context) { token := strings.TrimSpace(strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")); if token == "" { c.AbortWithStatusJSON(401, gin.H{"error":"Authentication required"}); return }; user, err := s.redis.Get(c, "session:"+token).Result(); if err != nil { c.AbortWithStatusJSON(401, gin.H{"error":"Session expired"}); return }; c.Set("userID", user); c.Next() } }
func (s *Server) issueToken(c context.Context, user string) string { b := make([]byte, 32); _, _ = rand.Read(b); token := hex.EncodeToString(b); s.redis.Set(c, "session:"+token, user, 24*time.Hour); return token }
func (s *Server) createPoll(c *gin.Context) { var in struct{ Question string `json:"question"`; Options []string `json:"options"` }; if c.ShouldBindJSON(&in) != nil || len(strings.TrimSpace(in.Question)) < 3 || len(in.Options) < 2 || len(in.Options) > 10 { c.JSON(400, gin.H{"error":"A question and 2–10 options are required"}); return }; seen := map[string]bool{}; for i := range in.Options { in.Options[i] = strings.TrimSpace(in.Options[i]); key := strings.ToLower(in.Options[i]); if in.Options[i] == "" || seen[key] { c.JSON(400, gin.H{"error":"Options must be unique and non-empty"}); return }; seen[key] = true }; p := Poll{Question: strings.TrimSpace(in.Question), Options: in.Options, CreatedBy: c.GetString("userID"), CreatedAt: time.Now().UTC()}; result, err := s.polls.InsertOne(c, p); if err != nil { c.JSON(500, gin.H{"error":"Could not create poll"}); return }; p.ID = result.InsertedID.(bson.ObjectID); for _, option := range p.Options { s.redis.HSet(c, "poll:"+p.ID.Hex()+":counts", option, 0) }; c.JSON(201, p) }
func (s *Server) getPoll(c *gin.Context) { id, err := bson.ObjectIDFromHex(c.Param("id")); if err != nil { c.Status(404); return }; var p Poll; if s.polls.FindOne(c, bson.M{"_id": id}).Decode(&p) != nil { c.Status(404); return }; c.JSON(200, p) }
func (s *Server) results(c *gin.Context) { if _, err := bson.ObjectIDFromHex(c.Param("id")); err != nil { c.Status(404); return }; values, _ := s.redis.HGetAll(c, "poll:"+c.Param("id")+":counts").Result(); c.JSON(200, gin.H{"counts": values}) }
func (s *Server) vote(c *gin.Context) { id := c.Param("id"); oid, err := bson.ObjectIDFromHex(id); if err != nil { c.Status(404); return }; var in Vote; if c.ShouldBindJSON(&in) != nil { c.JSON(400, gin.H{"error":"A valid option is required"}); return }; var p Poll; if s.polls.FindOne(c, bson.M{"_id": oid}).Decode(&p) != nil || !contains(p.Options, strings.TrimSpace(in.Option)) { c.JSON(400, gin.H{"error":"Poll or option not found"}); return }; if _, err := s.votes.InsertOne(c, VoteRecord{PollID: oid, Option: strings.TrimSpace(in.Option), CreatedAt: time.Now().UTC()}); err != nil { c.JSON(500, gin.H{"error":"Could not record vote"}); return }; if err := s.redis.HIncrBy(c, "poll:"+id+":counts", strings.TrimSpace(in.Option), 1).Err(); err != nil { c.JSON(503, gin.H{"error":"Live vote service unavailable"}); return }; if err := s.redis.Publish(c, "poll:"+id, strings.TrimSpace(in.Option)).Err(); err != nil { c.JSON(503, gin.H{"error":"Could not publish vote"}); return }; c.JSON(202, gin.H{"status":"recorded"}) }
func (s *Server) events(c *gin.Context) { pubsub := s.redis.Subscribe(c, "poll:"+c.Param("id")); defer pubsub.Close(); c.Stream(func(w io.Writer) bool { msg, err := pubsub.ReceiveMessage(c); if err != nil { return false }; c.SSEvent("vote", msg.Payload); return true }) }
func contains(items []string, target string) bool { for _, item := range items { if item == target { return true } }; return false }
func validCredentials(email, password string) bool { return strings.Contains(email, "@") && len(password) >= 8 }
func mustEnv(k string) string { if v := os.Getenv(k); v != "" { return v }; panic(errors.New(k+" is required")) }
func envOr(k, fallback string) string { if v := os.Getenv(k); v != "" { return v }; return fallback }
